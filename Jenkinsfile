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
                sh 'npm ci'
            }
        }
        stage('Run Playwright Tests') {
            steps {
                sh """
                export ENV=${params.ENV}
                npx playwright test
                """
            }
        }
  }
}