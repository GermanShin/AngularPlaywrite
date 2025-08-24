pipeline {
  agent any

  parameters {
    choice(
        name: 'ENV',
        choices: ['dev', 'test', 'stg'],  // List your envs here
        description: 'Select the environment to run Playwright tests against'
    )
  }

  stages {
    stage('Echo Env File') {
      steps {
        echo "Selected env: ${params.ENV_FILE}"
      }
    }

    stage('Install deps') {
        steps {
          dir('TestAutomation') {
              sh 'npm ci'
          }
        }
    }

    stage('Run Playwright Tests') {
        steps {
            dir('TestAutomation') {
                sh "ENV=${params.ENV} npx playwright test"
            }
        }
    }
  }
}