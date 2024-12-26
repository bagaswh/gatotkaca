FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

# Bundle app source
COPY src ./
# Compile TypeScript to JavaScript
RUN npm run build

COPY . .

RUN chmod +x bin/www
ENTRYPOINT [ "bin/www" ]
CMD ["--config.file", "examples/etc/app/config.yml"]