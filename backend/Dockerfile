FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
