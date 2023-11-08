#!/bin/bash

# Define the retention period in milliseconds (30 days in this case)
RETENTION_PERIOD_IN_DAYS=30
RETENTION_PERIOD_MS=$((RETENTION_PERIOD_IN_DAYS * 24 * 60 * 60 * 1000))
# Get the current Unix timestamp in milliseconds
CURRENT_MS=$(($(date +%s%3N)))

# Function to get the age of the image in milliseconds
get_age_ms() {
    echo $((CURRENT_MS - $1))
}

# Fetch the list of tags for the image
# Assuming you have jq installed and the GH CLI set up
tags=$(gh cr list --namespace osrd-project --name $IMAGE_NAME --json tag --jq '.[].tag' | tr -d '"')

# Loop over each tag
for tag in $tags; do
    # If the tag is a number (i.e., a Unix timestamp in milliseconds), check its age
    if [[ $tag =~ ^[0-9]+$ ]]; then
        age_ms=$(get_age_ms $tag)

        # If the age is greater than the retention period, delete the image
        if [ "$age_ms" -ge "$RETENTION_PERIOD_MS" ]; then
            echo "Deleting image osrd-project/$IMAGE_NAME:$tag..."
            gh cr delete osrd-project/$IMAGE_NAME:$tag
        else
            echo "Keeping image osrd-project/$IMAGE_NAME:$tag..."
        fi
    else
        echo "Skipping tag $tag as it does not represent a Unix timestamp in milliseconds."
    fi
done
