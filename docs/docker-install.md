# Install Docker

```sh
# Update packages for Docker installation
sudo apt-get update

# Install packages to allow use of repository over HTTPS
sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# Add Docker repository to APT sources
sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"

# Update Docker packages
sudo apt-get update

# Install Docker CE (Community Edition)
sudo apt-get install docker-ce

# Check if Docker is installed correctly by checking its version
docker --version

# Add user to Docker group
sudo usermod -aG docker $USER

# Reconnect ssh
```
