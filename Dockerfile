FROM node:24-slim

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libc6-dev \
    libvips-dev \
    libpng-dev \
    libjpeg-dev \
    autoconf \
    automake \
    nasm \
    libtool \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server_calorie_tracking

COPY server_calorie_tracking/package*.json ./
RUN npm install --production

COPY server_calorie_tracking/ .

EXPOSE 3000

CMD ["npm", "start"]