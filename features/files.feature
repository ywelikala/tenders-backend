Feature: File Management
  As a user of the tender portal
  I want to upload and manage files
  So that I can attach documents to tenders and manage my uploads

  Background:
    Given the API server is running
    And the database is clean
    And the uploads directory exists

  Scenario: Upload Single File (Authenticated)
    Given I am authenticated as a user
    And I have a valid PDF file to upload
    When I upload the file
    Then I should receive a success response
    And the file should be stored on the server
    And I should receive the file URL and metadata

  Scenario: Upload Single File without Authentication
    Given I have a valid PDF file to upload
    When I upload the file without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Upload Multiple Files (Authenticated)
    Given I am authenticated as a user
    And I have 3 valid files to upload
    When I upload all files
    Then I should receive a success response
    And all 3 files should be stored on the server
    And I should receive URLs and metadata for all files

  Scenario: Upload File with Invalid Format
    Given I am authenticated as a user
    And I have an executable file to upload
    When I upload the file
    Then I should receive a validation error
    And the error message should contain "File type not allowed"
    And the file should not be stored

  Scenario: Upload File Exceeding Size Limit
    Given I am authenticated as a user
    And I have a file larger than 10MB
    When I upload the file
    Then I should receive a validation error
    And the error message should contain "File size exceeds limit"
    And the file should not be stored

  Scenario: Upload File with No File Provided
    Given I am authenticated as a user
    When I upload without providing any file
    Then I should receive a validation error
    And the error message should contain "No file provided"

  Scenario: Upload Image File with Processing
    Given I am authenticated as a user
    And I have a valid image file to upload
    When I upload the image file
    Then I should receive a success response
    And the image should be processed and resized
    And thumbnail versions should be created
    And I should receive URLs for all versions

  Scenario: Upload Document File
    Given I am authenticated as a user
    And I have a valid Word document to upload
    When I upload the document
    Then I should receive a success response
    And the document should be stored with metadata
    And the file type should be correctly identified

  Scenario: Get Uploaded File by URL
    Given I am authenticated as a user
    And I have uploaded a file with URL "/uploads/test-file.pdf"
    When I request the file at "/uploads/test-file.pdf"
    Then I should receive the file content
    And the response should have correct content type
    And the response should have correct content disposition

  Scenario: Get Non-existent File
    When I request a file that doesn't exist "/uploads/non-existent.pdf"
    Then I should receive a not found error
    And the error should indicate file not found

  Scenario: Get User's Uploaded Files (Authenticated)
    Given I am authenticated as a user
    And I have uploaded 5 files
    When I request my uploaded files
    Then I should receive a success response
    And I should receive a list of 5 files
    And each file should contain metadata and URL

  Scenario: Get User's Uploaded Files without Authentication
    When I request my uploaded files without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Delete Uploaded File (Owner)
    Given I am authenticated as a user
    And I have uploaded a file with ID "507f1f77bcf86cd799439011"
    When I delete the file with ID "507f1f77bcf86cd799439011"
    Then I should receive a success response
    And the file should be removed from the server
    And the file metadata should be removed from the database

  Scenario: Delete Uploaded File without Authentication
    Given a file exists with ID "507f1f77bcf86cd799439011"
    When I delete the file with ID "507f1f77bcf86cd799439011" without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Delete Uploaded File as Non-Owner
    Given I am authenticated as a user
    And another user owns a file with ID "507f1f77bcf86cd799439011"
    When I delete the file with ID "507f1f77bcf86cd799439011"
    Then I should receive a forbidden error
    And the error message should contain "Not authorized to delete this file"

  Scenario: Delete Non-existent File
    Given I am authenticated as a user
    When I delete the file with ID "507f1f77bcf86cd799439000"
    Then I should receive a not found error
    And the error message should contain "File not found"

  Scenario: File Upload Rate Limiting
    Given I am authenticated as a user
    And I have exceeded the upload rate limit
    When I try to upload another file
    Then I should receive a rate limit error
    And the error message should contain "Too many requests"

  Scenario: File Upload Virus Scan (If Implemented)
    Given I am authenticated as a user
    And I have a suspicious file to upload
    When I upload the file
    Then the file should be scanned for viruses
    And if infected, the upload should be rejected
    And I should receive a security warning

  Scenario: Bulk File Upload
    Given I am authenticated as a user
    And I have a ZIP file containing multiple documents
    When I upload the ZIP file with extract option
    Then I should receive a success response
    And all files from the ZIP should be extracted and stored
    And I should receive metadata for all extracted files

  Scenario: File Metadata Update
    Given I am authenticated as a user
    And I have uploaded a file with ID "507f1f77bcf86cd799439011"
    And I have updated metadata for the file
    When I update the file metadata
    Then I should receive a success response
    And the file metadata should be updated in the database

  Scenario: File Access Control
    Given a file exists with private access settings
    And I am not the owner of the file
    When I try to access the private file
    Then I should receive a forbidden error
    And the error message should contain "Access denied"

  Scenario: File Storage Cleanup
    Given there are orphaned files in the storage
    When the cleanup process runs
    Then orphaned files should be identified
    And unused files should be removed from storage
    And storage space should be reclaimed