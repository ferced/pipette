#!/usr/bin/env bash
# Creates Pipette's AWS resources: a public-read S3 bucket for the open data, the ingest
# Lambda, its IAM roles, and two EventBridge Scheduler schedules.
#
# Usage:
#   JEV_API_KEY=... INDEXNOW_KEY=... BUCKET=my-pipette-data ./infra/setup.sh
#
# Requires the AWS CLI (configured) and Python 3. Safe to read before running: every step
# is a plain AWS CLI call.
set -euo pipefail

REGION="${REGION:-us-east-1}"
BUCKET="${BUCKET:?set BUCKET to a globally unique bucket name}"
FUNCTION="${FUNCTION:-pipette-ingest}"
: "${JEV_API_KEY:?set JEV_API_KEY (TypeSafe API key)}"
INDEXNOW_KEY="${INDEXNOW_KEY:-}"

cd "$(dirname "$0")"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
TMP="$(mktemp -d)"
render() { sed -e "s/ACCOUNT_ID/${ACCOUNT_ID}/g" -e "s/pipette-day-data/${BUCKET}/g" -e "s/pipette-ingest/${FUNCTION}/g" "$1" > "$TMP/$1"; }
for f in *.json; do render "$f"; done

echo "== S3 bucket ${BUCKET}"
aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "file://$TMP/bucket-policy.json"
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "file://$TMP/bucket-cors.json"

echo "== IAM roles"
aws iam create-role --role-name pipette-ingest-lambda --assume-role-policy-document "file://$TMP/lambda-trust.json" >/dev/null
aws iam put-role-policy --role-name pipette-ingest-lambda --policy-name pipette-ingest --policy-document "file://$TMP/lambda-policy.json"
aws iam create-role --role-name pipette-scheduler --assume-role-policy-document "file://$TMP/scheduler-trust.json" >/dev/null
aws iam put-role-policy --role-name pipette-scheduler --policy-name invoke-ingest --policy-document "file://$TMP/scheduler-policy.json"
sleep 10 # let IAM propagate

echo "== Lambda ${FUNCTION}"
../ingest/package.sh "$TMP/lambda.zip"
aws lambda create-function --region "$REGION" --function-name "$FUNCTION" --runtime python3.12 --architectures arm64 \
  --handler handler.lambda_handler --timeout 900 --memory-size 1024 \
  --role "arn:aws:iam::${ACCOUNT_ID}:role/pipette-ingest-lambda" --zip-file "fileb://$TMP/lambda.zip" \
  --environment "Variables={BUCKET=${BUCKET},JEV_API_KEY=${JEV_API_KEY},JEV_WORKERS=12,INDEXNOW_KEY=${INDEXNOW_KEY}}" >/dev/null

echo "== Schedules (06:00 and 12:00 UTC)"
aws scheduler create-schedule --region "$REGION" --name pipette-daily --schedule-expression "cron(0 6 * * ? *)" \
  --schedule-expression-timezone UTC --flexible-time-window Mode=OFF --target "file://$TMP/schedule-target.json" >/dev/null
aws scheduler create-schedule --region "$REGION" --name pipette-refresh --schedule-expression "cron(0 12 * * ? *)" \
  --schedule-expression-timezone UTC --flexible-time-window Mode=OFF --target "file://$TMP/schedule-target-refresh.json" >/dev/null

echo "Done. Data will be public at https://${BUCKET}.s3.${REGION}.amazonaws.com/v1/index.json after the first run."
echo "Run one day now with:"
echo "  aws lambda invoke --region ${REGION} --function-name ${FUNCTION} --payload '{}' --cli-binary-format raw-in-base64-out out.json"
