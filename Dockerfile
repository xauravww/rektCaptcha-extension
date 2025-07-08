FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

RUN npm init -y && npm install playwright

COPY . .

# Build your extension (make sure "build" script exists in package.json)
RUN npm run build

CMD ["node", "test.js"]
