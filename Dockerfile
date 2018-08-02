FROM mhart/alpine-node:10.7.0
WORKDIR /code/
COPY package*.json ./
RUN npm i > /dev/null
COPY . .
ENV PORT 3000
EXPOSE 3000
CMD npm start
