#  VPS Setup Guide

This guide details the step-by-step process to deploy the Video Editor application on an Ubuntu VPS (e.g., Azure, DigitalOcean). It covers security, infrastructure, reverse proxy configuration, and SSL setup.

---

## 1. Initial Server Setup & Security

Before deploying the application, we must secure the server.

### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Configure Firewall (UFW)
By default, the internal firewall might be inactive. We need to explicitly allow SSH before enabling it to avoid locking ourselves out.

```bash
# Check status
sudo ufw status

# Allow SSH (Critical!)
sudo ufw allow OpenSSH

# Enable Firewall
sudo ufw enable

# Verify
sudo ufw status verbose
```

> **Note for Azure/AWS Users**: You also need to open ports **80 (HTTP)** and **443 (HTTPS)** in your cloud provider's network security group (NSG) or firewall settings.

### 1.3 Disable Password Authentication (SSH Hardening)
To prevent brute-force attacks, disable password login and rely only on SSH keys.

1.  Edit the SSH config:
    ```bash
    sudo nano /etc/ssh/sshd_config
    ```
2.  Find and change these lines:
    ```ini
    PermitRootLogin no
    PasswordAuthentication no
    ```
3.  Restart SSH service:
    ```bash
    sudo systemctl restart ssh
    ```

---

## 2. Infrastructure Setup (Docker)

We will use Docker and Docker Compose to run the application.

### 2.1 Install Docker
```bash
sudo apt install docker.io -y
```

### 2.2 Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2.3 Configure User Permissions
Avoid using `sudo` for every Docker command by adding your user to the `docker` group.

```bash
# Add current user to docker group
sudo usermod -aG docker $USER

# Apply changes immediately
newgrp docker

# Verify
docker ps
```

---

## 3. Application Deployment

### 3.1 Directory Structure
Use `/opt` for production applications.

```bash
cd /opt
sudo mkdir video-editor
sudo chown $USER:$USER video-editor
cd video-editor
```

### 3.2 Clone Repository (Private Repo)
Since the repository is private, use an **SSH Deploy Key**.

1.  **Generate Key on VPS**:
    ```bash
    ssh-keygen -t ed25519 -C "vps-deploy-key"
    cat ~/.ssh/id_ed25519.pub
    ```
2.  **Add to GitHub**:
    *   Go to Repo Settings > **Deploy keys** > **Add deploy key**.
    *   Paste the key. Leave "Allow write access" **unchecked**.
3.  **Clone**:
    ```bash
    git clone git@github.com:Sangyog10/Video-Editor.git .
    ```

### 3.3 Environment Configuration
Create the production environment file.

```bash
cp .env.sample .env
nano .env
```
*Update the variables as needed (database passwords, etc.).*

---

## 4. Reverse Proxy Setup (Nginx)

Nginx will handle incoming traffic, SSL termination, and routing to our Docker containers.

### 4.1 Install Nginx
```bash
sudo apt install nginx -y
```

### 4.2 Configure Nginx
Create a new configuration file for the app.

```bash
sudo nano /etc/nginx/sites-available/video-editor
```

Paste the following configuration:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP; # e.g., sangyog-project.duckdns.org

    # 1. Increase Upload Size for Video Files
    client_max_body_size 500M; 

    # 2. Main Application (Frontend/API)
    location / {
        proxy_pass http://127.0.0.1:3000; 
        
        # Header Forwarding
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket Support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    # 3. MinIO Storage Traffic (Secure Proxy)
    # Routes https://domain.com/video-storage/ -> http://localhost:9000
    location /video-storage/ {
        proxy_pass http://127.0.0.1:9000;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        client_max_body_size 500M;
    }
}
```

### 4.3 Enable Configuration
Link the file to `sites-enabled` and remove the default config.

```bash
sudo ln -s /etc/nginx/sites-available/video-editor /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
```

### 4.4 Test and Reload
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Domain & SSL Setup

### 5.1 Domain Setup (DuckDNS)
1.  Register a domain at [duckdns.org](https://www.duckdns.org/).
2.  Point it to your VPS IP address.
3.  Update `server_name` in your Nginx config to match the domain.

### 5.2 SSL Certificate (Certbot)
Secure the site with HTTPS.

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Allow HTTPS traffic
sudo ufw allow 443/tcp

# Generate Certificate
sudo certbot --nginx -d your-domain.duckdns.org
```

---

## 6. Final Configuration Updates

Now that HTTPS is active, update the application to use the secure domain.

### 6.1 Update Frontend (.env)
```bash
# frontend/.env
VITE_API_TARGET=https://your-domain.duckdns.org/api
```

### 6.2 Update Backend (.env)
```bash
# .env
S3_PUBLIC_ENDPOINT=https://your-domain.duckdns.org/video-storage
```
*Note: We point to `/video-storage` because Nginx routes that path to MinIO.*

### 6.3 Update Docker Compose
Update `docker-compose.prod.yml` to set the MinIO server URL.

```yaml
  minio:
    environment:
       MINIO_SERVER_URL: https://your-domain.duckdns.org/video-storage
```

### 6.4 Rebuild and Restart
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

---

## ✅ Verification

1.  **Access Site**: Go to `https://your-domain.duckdns.org`. You should see the lock icon.
2.  **Test Upload**: Upload a video.
    *   The browser should send a PUT request to `https://your-domain.duckdns.org/video-storage/...`.
    *   It should **not** fail with "Mixed Content" errors.
