#!/bin/sh

# From https://www.dropbox.com/s/zjdp6d6h79jq4cr/ctsdata.20140211.tar?dl=0

tar xf ctsdata.20140211.tar
gunzip cts.dump.csv.gz
gunzip dividends.dump.csv.gz
gunzip splits.dump.csv.gz
