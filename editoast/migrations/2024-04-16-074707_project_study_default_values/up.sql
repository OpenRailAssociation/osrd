-- Your SQL goes here

ALTER TABLE "project"
ALTER "objectives" SET DEFAULT '',
ALTER "objectives" DROP NOT NULL;

ALTER TABLE "project"
ALTER "description" SET DEFAULT '',
ALTER "description" DROP NOT NULL;

ALTER TABLE "project"
ALTER "funders" SET DEFAULT '',
ALTER "funders" DROP NOT NULL;

ALTER TABLE "study"
ALTER "description" SET DEFAULT '',
ALTER "description" DROP NOT NULL;

ALTER TABLE "study"
ALTER "business_code" SET DEFAULT '',
ALTER "business_code" DROP NOT NULL;

ALTER TABLE "study"
ALTER "service_code" SET DEFAULT '',
ALTER "service_code" DROP NOT NULL;

ALTER TABLE "study"
ALTER "study_type" SET DEFAULT '',
ALTER "study_type" DROP NOT NULL;
