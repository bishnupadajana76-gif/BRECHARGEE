
name: Manual workflow

on:
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Show success message
        run: echo "BRecharge workflow is running"
