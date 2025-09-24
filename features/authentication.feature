Feature: User Authentication
  As a user of the tender portal
  I want to authenticate with the system
  So that I can access protected resources

  Background:
    Given the API server is running
    And the database is clean

  Scenario: User Registration with Valid Data
    Given I have valid registration data
    When I submit a registration request
    Then I should receive a success response
    And I should receive a JWT token
    And the user should be created in the database

  Scenario: User Registration with Invalid Email
    Given I have registration data with invalid email "invalid-email"
    When I submit a registration request
    Then I should receive an error response
    And the error message should contain "Invalid email format"

  Scenario: User Registration with Weak Password
    Given I have registration data with weak password "123"
    When I submit a registration request
    Then I should receive an error response
    And the error message should contain "Password must be at least 8 characters"

  Scenario: User Registration with Existing Email
    Given a user already exists with email "existing@example.com"
    And I have registration data with email "existing@example.com"
    When I submit a registration request
    Then I should receive an error response
    And the error message should contain "User already exists"

  Scenario: User Login with Valid Credentials
    Given a user exists with email "test@example.com" and password "ValidPassword123"
    When I login with email "test@example.com" and password "ValidPassword123"
    Then I should receive a success response
    And I should receive a JWT token
    And the token should contain user information

  Scenario: User Login with Invalid Email
    Given a user exists with email "test@example.com" and password "ValidPassword123"
    When I login with email "wrong@example.com" and password "ValidPassword123"
    Then I should receive an error response
    And the error message should contain "Invalid email or password"

  Scenario: User Login with Invalid Password
    Given a user exists with email "test@example.com" and password "ValidPassword123"
    When I login with email "test@example.com" and password "wrongpassword"
    Then I should receive an error response
    And the error message should contain "Invalid email or password"

  Scenario: Get User Profile with Valid Token
    Given I am authenticated as a user
    When I request my profile
    Then I should receive a success response
    And I should receive my user profile data

  Scenario: Get User Profile without Token
    When I request my profile without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Get User Profile with Invalid Token
    Given I have an invalid JWT token
    When I request my profile with the invalid token
    Then I should receive an unauthorized error
    And the error message should contain "Invalid token"

  Scenario: Update User Profile with Valid Data
    Given I am authenticated as a user
    And I have valid profile update data
    When I update my profile
    Then I should receive a success response
    And my profile should be updated in the database

  Scenario: Change Password with Valid Data
    Given I am authenticated as a user
    And I have valid password change data
    When I change my password
    Then I should receive a success response
    And my password should be updated in the database

  Scenario: Change Password with Wrong Current Password
    Given I am authenticated as a user
    And I have password change data with wrong current password
    When I change my password
    Then I should receive an error response
    And the error message should contain "Current password is incorrect"

  Scenario: Forgot Password with Valid Email
    Given a user exists with email "test@example.com"
    When I request password reset for email "test@example.com"
    Then I should receive a success response
    And a password reset token should be generated
    And the message should contain "Password reset email sent"

  Scenario: Forgot Password with Non-existent Email
    When I request password reset for email "nonexistent@example.com"
    Then I should receive an error response
    And the error message should contain "User not found"

  Scenario: Reset Password with Valid Token
    Given a user exists with a valid password reset token
    When I reset the password with the valid token and new password
    Then I should receive a success response
    And the password should be updated in the database
    And the reset token should be invalidated

  Scenario: Reset Password with Invalid Token
    When I reset the password with an invalid token
    Then I should receive an error response
    And the error message should contain "Invalid or expired reset token"

  Scenario: User Logout
    Given I am authenticated as a user
    When I logout
    Then I should receive a success response
    And the message should contain "Logged out successfully"

  Scenario: Rate Limiting on Login Attempts
    Given I have made too many login attempts
    When I try to login again
    Then I should receive a rate limit error
    And the error message should contain "Too many requests"