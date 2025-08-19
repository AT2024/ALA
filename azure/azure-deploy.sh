#!/bin/bash

# Configuration Variables
RESOURCE_GROUP="ala-resource-group"
LOCATION="westeurope"
ACR_NAME="alaregistry"
APP_NAME="accountability-log-app"
DATABASE_NAME="ala-db"
DATABASE_SKU="Basic"
DATABASE_USERNAME="postgres"
DATABASE_PASSWORD="P@ssw0rd123!"  # Change this for production!

# Set the current subscription (uncomment and set if needed)
# az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Create Resource Group
echo "Creating Resource Group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
echo "Creating Azure Container Registry..."
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true

# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query "username" -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

# Log in to ACR
echo "Logging in to ACR..."
az acr login --name $ACR_NAME

# Build and push backend image
echo "Building and pushing backend image..."
cd ../backend
az acr build --registry $ACR_NAME --image ala-backend:latest .

# Build and push frontend image
echo "Building and pushing frontend image..."
cd ../frontend
az acr build --registry $ACR_NAME --image ala-frontend:latest .

# Create Azure Database for PostgreSQL
echo "Creating PostgreSQL database..."
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DATABASE_NAME \
  --location $LOCATION \
  --admin-user $DATABASE_USERNAME \
  --admin-password $DATABASE_PASSWORD \
  --sku-name $DATABASE_SKU \
  --version 15 \
  --yes

# Create database
echo "Creating application database..."
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DATABASE_NAME \
  --database-name ala_db

# Allow Azure services
echo "Configuring firewall rules..."
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $DATABASE_NAME \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create App Service Plan
echo "Creating App Service Plan..."
az appservice plan create \
  --resource-group $RESOURCE_GROUP \
  --name ala-service-plan \
  --is-linux \
  --sku B1

# Create Web App for Backend
echo "Creating Web App for Backend..."
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan ala-service-plan \
  --name $APP_NAME-api \
  --deployment-container-image-name $ACR_NAME.azurecr.io/ala-backend:latest

# Create Web App for Frontend
echo "Creating Web App for Frontend..."
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan ala-service-plan \
  --name $APP_NAME \
  --deployment-container-image-name $ACR_NAME.azurecr.io/ala-frontend:latest

# Configure Backend Environment Variables
echo "Configuring Backend Environment Variables..."
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME-api \
  --settings \
  NODE_ENV=production \
  PORT=80 \
  DATABASE_URL="postgres://$DATABASE_USERNAME:$DATABASE_PASSWORD@$DATABASE_NAME.postgres.database.azure.com:5432/ala_db?sslmode=require" \
  JWT_SECRET="your-jwt-secret-key-change-in-production" \
  PRIORITY_URL="https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24"

# Configure Frontend Environment Variables
echo "Configuring Frontend Environment Variables..."
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
  API_URL="https://$APP_NAME-api.azurewebsites.net"

# Configure Container Registry Settings in Web Apps
echo "Configuring Container Registry Settings..."
az webapp config container set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME-api \
  --docker-custom-image-name $ACR_NAME.azurecr.io/ala-backend:latest \
  --docker-registry-server-url https://$ACR_NAME.azurecr.io \
  --docker-registry-server-user $ACR_USERNAME \
  --docker-registry-server-password $ACR_PASSWORD

az webapp config container set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --docker-custom-image-name $ACR_NAME.azurecr.io/ala-frontend:latest \
  --docker-registry-server-url https://$ACR_NAME.azurecr.io \
  --docker-registry-server-user $ACR_USERNAME \
  --docker-registry-server-password $ACR_PASSWORD

echo "Deployment completed!"
echo "Frontend URL: https://$APP_NAME.azurewebsites.net"
echo "Backend API URL: https://$APP_NAME-api.azurewebsites.net"
