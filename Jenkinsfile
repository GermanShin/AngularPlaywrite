pipeline {
  agent any

  parameters {
    choice(
      name: 'ENV_FILE',
      choices: ['env/env.dev', 'env/env.qa'],
      description: 'Choose environment'
    )
  }

  stages {
    stage('Echo Env File') {
      steps {
        echo "Selected env: ${params.ENV_FILE}"
      }
    }
  }
}