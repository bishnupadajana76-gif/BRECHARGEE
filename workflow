
name: Initialize BRecharge Admin

'on':
  workflow_dispatch:
  push:
    branches:
      - main

jobs:
  initialize:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Check workflow
        run: echo "Workflow trigger is working"
