Feature: Subscription Management
  As a user of the tender portal
  I want to manage my subscription
  So that I can access premium features and services

  Background:
    Given the API server is running
    And the database is clean
    And the Stripe test environment is configured

  Scenario: Get Available Subscription Plans
    Given there are subscription plans available
    When I request all subscription plans
    Then I should receive a success response
    And I should receive a list of subscription plans
    And each plan should contain pricing and feature information

  Scenario: Get Subscription Plans with Pricing Details
    When I request subscription plans
    Then I should receive a success response
    And each plan should have a valid price
    And each plan should have feature descriptions
    And plans should be ordered by price

  Scenario: Create Subscription Session (Authenticated)
    Given I am authenticated as a user
    And I select a valid subscription plan
    When I create a subscription checkout session
    Then I should receive a success response
    And I should receive a Stripe checkout session URL
    And the session should be valid for 24 hours

  Scenario: Create Subscription Session without Authentication
    Given I select a valid subscription plan
    When I create a subscription checkout session without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Create Subscription Session with Invalid Plan
    Given I am authenticated as a user
    And I select an invalid subscription plan ID
    When I create a subscription checkout session
    Then I should receive a validation error
    And the error message should contain "Invalid subscription plan"

  Scenario: Create Subscription Session for Already Subscribed User
    Given I am authenticated as a user
    And I already have an active subscription
    When I create a subscription checkout session
    Then I should receive an error response
    And the error message should contain "User already has an active subscription"

  Scenario: Get Current User Subscription (Authenticated)
    Given I am authenticated as a user
    And I have an active subscription
    When I request my current subscription
    Then I should receive a success response
    And I should receive my subscription details
    And the subscription should show as active

  Scenario: Get Current User Subscription without Authentication
    When I request my current subscription without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Get Current User Subscription (No Subscription)
    Given I am authenticated as a user
    And I do not have any subscription
    When I request my current subscription
    Then I should receive a success response
    And the subscription should be null
    And the message should indicate no active subscription

  Scenario: Cancel Subscription (Authenticated)
    Given I am authenticated as a user
    And I have an active subscription
    When I cancel my subscription
    Then I should receive a success response
    And my subscription should be marked for cancellation
    And I should receive a cancellation confirmation

  Scenario: Cancel Subscription without Authentication
    When I cancel my subscription without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Cancel Non-existent Subscription
    Given I am authenticated as a user
    And I do not have any subscription
    When I cancel my subscription
    Then I should receive an error response
    And the error message should contain "No active subscription found"

  Scenario: Update Subscription Plan (Upgrade)
    Given I am authenticated as a user
    And I have an active basic subscription
    And I want to upgrade to a premium plan
    When I update my subscription plan
    Then I should receive a success response
    And my subscription should be updated to the premium plan
    And the billing should be prorated

  Scenario: Update Subscription Plan (Downgrade)
    Given I am authenticated as a user
    And I have an active premium subscription
    And I want to downgrade to a basic plan
    When I update my subscription plan
    Then I should receive a success response
    And my subscription should be scheduled to downgrade at the next billing cycle
    And I should retain premium features until the billing cycle ends

  Scenario: Update Subscription Plan without Authentication
    When I update my subscription plan without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Stripe Webhook - Successful Payment
    Given a user has completed checkout for a subscription
    When Stripe sends a successful payment webhook
    Then the user's subscription should be activated
    And the user should receive access to premium features
    And a confirmation email should be queued

  Scenario: Stripe Webhook - Failed Payment
    Given a user has an active subscription
    When Stripe sends a failed payment webhook
    Then the user's subscription should be marked as past due
    And the user should receive a payment failure notification
    And access to premium features should be restricted

  Scenario: Stripe Webhook - Subscription Cancelled
    Given a user has an active subscription
    When Stripe sends a subscription cancelled webhook
    Then the user's subscription should be deactivated
    And the user should lose access to premium features
    And a cancellation confirmation should be sent

  Scenario: Stripe Webhook - Invalid Signature
    When Stripe sends a webhook with invalid signature
    Then I should receive an unauthorized error
    And the webhook should be rejected
    And no subscription changes should be made

  Scenario: Get Subscription History (Authenticated)
    Given I am authenticated as a user
    And I have subscription history
    When I request my subscription history
    Then I should receive a success response
    And I should receive a list of my past subscriptions
    And each entry should contain subscription details and dates

  Scenario: Get Subscription History without Authentication
    When I request my subscription history without authentication
    Then I should receive an unauthorized error
    And the error message should contain "No token provided"

  Scenario: Subscription Feature Access Control
    Given I am authenticated as a user
    And I have a basic subscription
    When I try to access a premium feature
    Then I should receive a forbidden error
    And the error message should contain "Upgrade required"

  Scenario: Subscription Renewal Notification
    Given a user has a subscription expiring in 3 days
    When the system processes subscription renewals
    Then a renewal reminder should be queued
    And the user should receive an email notification

  Scenario: Expired Subscription Handling
    Given a user has an expired subscription
    When the system processes expired subscriptions
    Then the user's access should be revoked
    And the subscription status should be updated to expired
    And the user should receive an expiration notification