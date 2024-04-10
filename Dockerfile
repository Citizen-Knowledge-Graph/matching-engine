# docker build -t foerderfunke-server .
# docker run -p 3000:3000 -d foerderfunke-server
# --> see dev/dev-docker-endpoint-call.js for an example how to call the endpoint

FROM node:20.11.1

WORKDIR home/app
COPY . .
RUN npm install
EXPOSE 3000

CMD [ "npm", "run", "server" ]
