#!/bin/sh
# Lambda entry point. The AWS Lambda Web Adapter layer forwards each request to this server.
exec node server.js
