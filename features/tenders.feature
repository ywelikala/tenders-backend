Feature: Tender Management
  As a user of the tender portal
  I want to manage tenders
  So that I can create, view, update, and delete tender opportunities

  Background:
    Given the API server is running
    And the database is clean

  Scenario: Get All Tenders (Public Access)
    Given there are 5 tenders in the database
    When I request all tenders without authentication
    Then I should receive a success response
    And I should receive a list of 5 tenders
    And each tender should contain basic information

  Scenario: Get All Tenders with Pagination
    Given there are 25 tenders in the database
    When I request tenders with page 2 and limit 10
    Then I should receive a success response
    And I should receive 10 tenders
    And the pagination should show page 2 of 3

  Scenario: Get All Tenders with Category Filter
    Given there are tenders with category "IT Services"
    And there are tenders with category "Construction"
    When I request tenders filtered by category "IT Services"
    Then I should receive a success response
    And all returned tenders should have category "IT Services"

  Scenario: Get All Tenders with Status Filter
    Given there are tenders with status "active"
    And there are tenders with status "closed"
    When I request tenders filtered by status "active"
    Then I should receive a success response
    And all returned tenders should have status "active"

  Scenario: Get All Tenders with Search Query
    Given there are tenders with titles containing "Software Development"
    And there are tenders with descriptions containing "Database Management"
    When I search tenders with query "Software"
    Then I should receive a success response
    And all returned tenders should match the search query

  Scenario: Get All Tenders with Location Filter
    Given there are tenders in location "Colombo"
    And there are tenders in location "Kandy"
    When I request tenders filtered by location "Colombo"
    Then I should receive a success response
    And all returned tenders should be in location "Colombo"

  Scenario: Get Single Tender by ID (Public Access)
    Given a tender exists with ID "507f1f77bcf86cd799439011"
    When I request the tender with ID "507f1f77bcf86cd799439011"
    Then I should receive a success response
    And I should receive the tender details
    And the tender should contain all required fields

  Scenario: Get Single Tender with Non-existent ID
    When I request the tender with ID "507f1f77bcf86cd799439000"
    Then I should receive a not found error
    And the error message should contain "Tender not found"

  Scenario: Get Single Tender with Invalid ID Format
    When I request the tender with ID "invalid-id"
    Then I should receive a bad request error
    And the error message should contain "Invalid tender ID format"

  Scenario: Get Tender Statistics
    Given there are 10 active tenders
    And there are 5 closed tenders
    And there are 3 draft tenders
    When I request tender statistics
    Then I should receive a success response
    And the statistics should show 10 active tenders
    And the statistics should show 5 closed tenders
    And the statistics should show 3 draft tenders

  Scenario: Create Tender with Valid Data (Authenticated)
    Given I am authenticated as a user
    And I have valid tender creation data
    When I create a tender
    Then I should receive a success response
    And the tender should be created in the database
    And the tender should be associated with my user account

  Scenario: Create Tender without Authentication
    Given I have valid tender creation data
    When I create a tender without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Create Tender with Invalid Data
    Given I am authenticated as a user
    And I have tender creation data with missing required fields
    When I create a tender
    Then I should receive a validation error
    And the error should specify which fields are required

  Scenario: Create Tender with Invalid Budget
    Given I am authenticated as a user
    And I have tender creation data with negative budget
    When I create a tender
    Then I should receive a validation error
    And the error message should contain "Budget must be a positive number"

  Scenario: Create Tender with Invalid Dates
    Given I am authenticated as a user
    And I have tender creation data with closing date before opening date
    When I create a tender
    Then I should receive a validation error
    And the error message should contain "Closing date must be after opening date"

  Scenario: Update Tender with Valid Data (Owner)
    Given I am authenticated as a user
    And I own a tender with ID "507f1f77bcf86cd799439011"
    And I have valid tender update data
    When I update the tender with ID "507f1f77bcf86cd799439011"
    Then I should receive a success response
    And the tender should be updated in the database

  Scenario: Update Tender without Authentication
    Given a tender exists with ID "507f1f77bcf86cd799439011"
    And I have valid tender update data
    When I update the tender with ID "507f1f77bcf86cd799439011" without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Update Tender as Non-Owner
    Given I am authenticated as a user
    And another user owns a tender with ID "507f1f77bcf86cd799439011"
    And I have valid tender update data
    When I update the tender with ID "507f1f77bcf86cd799439011"
    Then I should receive a forbidden error
    And the error message should contain "Not authorized to update this tender"

  Scenario: Update Non-existent Tender
    Given I am authenticated as a user
    And I have valid tender update data
    When I update the tender with ID "507f1f77bcf86cd799439000"
    Then I should receive a not found error
    And the error message should contain "Tender not found"

  Scenario: Delete Tender (Owner)
    Given I am authenticated as a user
    And I own a tender with ID "507f1f77bcf86cd799439011"
    When I delete the tender with ID "507f1f77bcf86cd799439011"
    Then I should receive a success response
    And the tender should be removed from the database

  Scenario: Delete Tender without Authentication
    Given a tender exists with ID "507f1f77bcf86cd799439011"
    When I delete the tender with ID "507f1f77bcf86cd799439011" without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Delete Tender as Non-Owner
    Given I am authenticated as a user
    And another user owns a tender with ID "507f1f77bcf86cd799439011"
    When I delete the tender with ID "507f1f77bcf86cd799439011"
    Then I should receive a forbidden error
    And the error message should contain "Not authorized to delete this tender"

  Scenario: Delete Non-existent Tender
    Given I am authenticated as a user
    When I delete the tender with ID "507f1f77bcf86cd799439000"
    Then I should receive a not found error
    And the error message should contain "Tender not found"

  Scenario: Get My Tenders (Authenticated)
    Given I am authenticated as a user
    And I have created 3 tenders
    When I request my tenders
    Then I should receive a success response
    And I should receive a list of 3 tenders
    And all tenders should belong to me

  Scenario: Get My Tenders without Authentication
    When I request my tenders without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Tender Expiry Handling
    Given there is a tender that expires today
    When the system processes tender expiry
    Then the tender status should be updated to "closed"
    And the closing date should be in the past

  Scenario: Tender Search with Multiple Filters
    Given there are tenders with various attributes
    When I search tenders with multiple filters (category, location, budget range)
    Then I should receive a success response
    And all returned tenders should match all the specified filters