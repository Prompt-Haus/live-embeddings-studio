#!/bin/bash
set -ex

# Install NVIDIA drivers + container toolkit
apt-get update
apt-get install -y ca-certificates curl gnupg

# Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin

# NVIDIA drivers
apt-get install -y linux-modules-extra-$(uname -r)
apt-get install -y ubuntu-drivers-common
ubuntu-drivers install --gpgpu

# NVIDIA Container Toolkit
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' > /etc/apt/sources.list.d/nvidia-container-toolkit.list
apt-get update
apt-get install -y nvidia-container-toolkit
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker

# Pull and run Smelter with GPU
docker pull ghcr.io/software-mansion/smelter:v0.5.0
docker run -d \
  --name smelter \
  --gpus all \
  --runtime=nvidia \
  -p 8081:8081 \
  -p 9000:9000 \
  -e SMELTER_LOGGER_FORMAT=pretty \
  --restart unless-stopped \
  ghcr.io/software-mansion/smelter:v0.5.0
