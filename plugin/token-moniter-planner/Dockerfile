FROM node:18-alpine

WORKDIR /app

COPY . .

RUN chmod +x ./entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
