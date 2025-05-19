#!/usr/bin/env python3
"""
Fix Cloud Run traffic routing to only route to existing revisions
"""

import subprocess
import json
import sys

def main():
    service_name = "prop-management"
    region = "europe-west4"
    project = "rentalspot-fzwom"
    
    print(f"Fixing traffic for {service_name} in {region}...")
    
    # Get current service configuration
    cmd = [
        "gcloud", "run", "services", "describe", service_name,
        "--region", region,
        "--project", project,
        "--format", "json"
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error getting service: {result.stderr}")
        return 1
    
    service = json.loads(result.stdout)
    
    # Get list of existing revisions
    cmd = [
        "gcloud", "run", "revisions", "list",
        "--service", service_name,
        "--region", region,
        "--project", project,
        "--format", "json"
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error getting revisions: {result.stderr}")
        return 1
    
    revisions = json.loads(result.stdout)
    existing_revision_names = [r["metadata"]["name"] for r in revisions]
    
    # Get latest revision
    latest_revision = revisions[0]["metadata"]["name"]
    print(f"Latest revision: {latest_revision}")
    print(f"Existing revisions: {existing_revision_names}")
    
    # Prepare new traffic configuration
    new_traffic = [{
        "revisionName": latest_revision,
        "percent": 100
    }]
    
    # Export service configuration
    export_file = "/tmp/service.yaml"
    cmd = [
        "gcloud", "run", "services", "describe", service_name,
        "--region", region,
        "--project", project,
        "--format", "export",
        ">", export_file
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error exporting service: {result.stderr}")
        return 1
    
    # Read and modify the YAML
    with open(export_file, 'r') as f:
        content = f.read()
    
    # Replace traffic section
    import yaml
    service_config = yaml.safe_load(content)
    service_config['spec']['traffic'] = new_traffic
    
    # Write back
    with open(export_file, 'w') as f:
        yaml.dump(service_config, f)
    
    # Apply the new configuration
    print("Applying new traffic configuration...")
    cmd = [
        "gcloud", "run", "services", "replace", export_file,
        "--region", region,
        "--project", project
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error applying configuration: {result.stderr}")
        return 1
    
    print("Traffic configuration updated successfully!")
    print(f"All traffic now routes to: {latest_revision}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())