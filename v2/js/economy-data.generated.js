'use strict';

/* Generated from data/economy.json. Edit the JSON source, not this file. */
window.VCS_ECONOMY_DATA = {
  "version": 1,
  "openingState": {
    "cash": 700,
    "activeUsers": 84,
    "prepaidCredits": 80,
    "energy": 4,
    "aiDaily": 2.25
  },
  "energyMaximum": 5,
  "operatingDayHours": 15,
  "revenuePerUserDay": 0.09,
  "dailyRental": {
    "baseAmount": 150,
    "inflationElasticity": 0,
    "label": "Daily rental"
  },
  "creditPack": {
    "credits": 200,
    "day7Price": 120,
    "day8Price": 180
  },
  "day8InferenceMultiplier": 1.5,
  "actionCosts": {
    "oracleDay7": {
      "build": {
        "credits": 80,
        "durationMinutes": 60,
        "energy": 1
      },
      "test": {
        "credits": 20,
        "durationMinutes": 30,
        "energy": 0
      },
      "revise": {
        "credits": 36,
        "durationMinutes": 45,
        "energy": 1
      },
      "release": {
        "credits": 0,
        "durationMinutes": 30,
        "energy": 0
      }
    },
    "oracleDay8": {
      "build": {
        "credits": 180,
        "durationMinutes": 60,
        "energy": 1
      },
      "test": {
        "credits": 20,
        "durationMinutes": 30,
        "energy": 0
      },
      "release": {
        "credits": 0,
        "durationMinutes": 30,
        "energy": 0
      }
    },
    "testBench": {
      "credits": 30,
      "durationMinutes": 60,
      "energy": 1
    }
  },
  "oracleTestingStrategies": {
    "day7SecondPhoto": {
      "prompt": "The reported failure is fixed. Decide how much additional evidence to buy before release.",
      "choices": {
        "test": {
          "label": "Test a second clear photo",
          "description": "Spend 30 minutes and 20 Credits to test whether a new scan starts clean.",
          "costAction": "test",
          "releaseScopes": [
            "evidence",
            "wide"
          ]
        },
        "skip": {
          "label": "Release after one test",
          "description": "Save the time and Credits. Release only to the reported case; repeat scans remain untested.",
          "releaseScopes": [
            "evidence"
          ]
        }
      }
    }
  },
  "recoveryActions": [
    {
      "id": "sleep",
      "label": "Sleep",
      "baseCashCost": 0,
      "inflationElasticity": 0,
      "durationMinutes": 120,
      "energyDelta": 2
    },
    {
      "id": "coffee",
      "label": "Get coffee",
      "baseCashCost": 18,
      "inflationElasticity": 1,
      "durationMinutes": 30,
      "energyDelta": 2
    }
  ],
  "storyEconomy": {
    "day7SkippedUsers": 7,
    "hqDemoReward": {
      "baseAmount": 180,
      "inflationElasticity": 1,
      "marketStageElasticity": 1
    }
  }
};
