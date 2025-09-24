Feature: System Health and Monitoring
  As a system administrator
  I want to monitor the health of the tender portal API
  So that I can ensure system availability and performance

  Background:
    Given the API server is running

  Scenario: Basic Health Check
    When I request the basic health check endpoint
    Then I should receive a success response
    And the response should contain server status
    And the response should contain timestamp
    And the response should indicate the server is running

  Scenario: Enhanced API Health Check
    When I request the enhanced API health check endpoint
    Then I should receive a success response
    And the response should contain detailed system information
    And the response should contain uptime information
    And the response should contain memory usage statistics
    And the response should contain environment information
    And the response should contain service status

  Scenario: Database Health Check
    Given the database is connected
    When I request the enhanced API health check
    Then the database status should show as "connected"
    And database connectivity should be verified

  Scenario: Database Health Check with Connection Issues
    Given the database connection is down
    When I request the enhanced API health check
    Then the database status should show as "disconnected"
    And the overall health should indicate degraded status

  Scenario: Service Health Check - Authentication Service
    When I request the API health check
    Then the authentication service should show as available
    And the auth service status should be true

  Scenario: Service Health Check - Tender Service
    When I request the API health check
    Then the tender service should show as available
    And the tender service status should be true

  Scenario: Service Health Check - File Service
    When I request the API health check
    Then the file service should show as available
    And the file service status should be true

  Scenario: Memory Usage Monitoring
    When I request the enhanced API health check
    Then the memory usage should be reported
    And the memory usage should include heap statistics
    And the memory usage should include RSS information

  Scenario: System Uptime Monitoring
    Given the server has been running for at least 1 minute
    When I request the enhanced API health check
    Then the uptime should be greater than 60 seconds
    And the uptime should be in a readable format

  Scenario: Environment Information
    When I request the enhanced API health check
    Then the environment should be correctly reported
    And the environment should match the current NODE_ENV

  Scenario: Response Time Monitoring
    When I make multiple requests to the health check endpoint
    Then all responses should be received within 200ms
    And the response times should be consistent

  Scenario: Health Check During High Load
    Given the system is under high load
    When I request the health check endpoint
    Then I should still receive a response
    And the response time should be acceptable
    And the system should report load statistics

  Scenario: Health Check Logging
    When I request the health check endpoint
    Then the request should be logged with appropriate level
    And the log should contain request details
    And the log should not contain sensitive information

  Scenario: Health Check Rate Limiting
    Given I make multiple health check requests rapidly
    When I exceed the rate limit
    Then I should receive a rate limit response
    But the system health should remain stable

  Scenario: Health Check Authentication Not Required
    When I request the health check endpoint without authentication
    Then I should receive a success response
    And no authentication should be required
    And the response should contain public health information

  Scenario: 404 Error Handling
    When I request a non-existent endpoint
    Then I should receive a 404 error
    And the error should be properly formatted
    And the error should be logged

  Scenario: CORS Headers on Health Check
    When I request the health check from a different origin
    Then I should receive appropriate CORS headers
    And the request should not be blocked by CORS policy

  Scenario: Health Check Content Type
    When I request the health check endpoint
    Then the response content type should be "application/json"
    And the response should be valid JSON

  Scenario: Health Check During Maintenance Mode
    Given the system is in maintenance mode
    When I request the health check endpoint
    Then I should receive a maintenance mode response
    And the status should indicate maintenance

  Scenario: Graceful Shutdown Health Check
    Given the server is shutting down gracefully
    When I request the health check endpoint
    Then I should receive a shutdown status
    And existing connections should be handled properly