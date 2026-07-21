const JavaLanguageClient = require('../lib/main.js')

describe('main', () => {
  describe('parsing `Java --showVersion --version` output', () => {
    it('returns null for unmatched input', () => {
      const version = JavaLanguageClient.getJavaVersionFromOutput("my homemade java v1.9.2.1")
      expect(version).to.be.null
    })

    it('returns 1.8 for Sun Java SE 1.8.0_40', () => {
      const version = JavaLanguageClient.getJavaVersionFromOutput('java version "1.8.0_40"'
        + '\nJava(TM) SE Runtime Environment (build 1.8.0_40-b27)'
        + '\nJava HotSpot(TM) 64-Bit Server VM (build 25.40-b25, mixed mode)')
      expect(version).to.be.equal(1.8)
    })

    it('returns 1.8 for OpenJDK 1.8 (ubuntu)', () => {
      const version = JavaLanguageClient.getJavaVersionFromOutput('openjdk version "1.8.0_131"'
        + '\nOpenJDK Runtime Environment (build 1.8.0_131-8u131-b11-2ubuntu1.17.04.3-b11)'
        + '\nOpenJDK 64-Bit Server VM (build 25.131-b11, mixed mode)')
      expect(version).to.be.equal(1.8)
    })

    it('returns 1.8 for OpenJDK 1.8 (custom)', () => {
      // #54
      const version = JavaLanguageClient.getJavaVersionFromOutput('openjdk version "1.8.0_172-solus"'
        + '\nOpenJDK Runtime Environment (build 1.8.0_172-solus-b00)'
        + '\nOpenJDK 64-Bit Server VM (build 25.172-b00, mixed mode)')
      expect(version).to.be.equal(1.8)
    })

    it('returns 1.8 for OpenJDK 1.8 (macOS)', () => {
      // #62
      const version = JavaLanguageClient.getJavaVersionFromOutput('openjdk version "1.8.0_152-release"'
        + '\nOpenJDK Runtime Environment (build 1.8.0_152-release-915-b08)'
        + '\nOpenJDK 64-Bit Server VM (build 25.152-b08, mixed mode)')
      expect(version).to.be.equal(1.8)
    })

    it('returns 8 for Sun OpenJDK 1.8', () => {
      const version = JavaLanguageClient.getJavaVersionFromOutput('java version "9"'
        + '\nJava(TM) SE Runtime Environment (build 9+181)'
        + '\nJava HotSpot(TM) 64-Bit Server VM (build 9+181, mixed mode)')
      expect(version).to.be.equal(9)
    })

    it('returns 17 for OpenJDK 17.0.4', () => {
      const version = JavaLanguageClient.getJavaVersionFromOutput('openjdk version "17.0.4" 2022-07-19 LTS'
        + '\nOpenJDK Runtime Environment Temurin-17.0.4+8 (build 17.0.4+8)'
        + '\nOpenJDK 64-Bit Server VM Temurin-17.0.4+8 (build 17.0.4+8, mixed mode)')
      expect(version).to.be.equal(17)
    })

    it('returns 21 for OpenJDK 21.0.4', () => {
      const version = JavaLanguageClient.getJavaVersionFromOutput('openjdk version "21.0.4" 2024-07-16 LTS'
        + '\nOpenJDK Runtime Environment Temurin-21.0.4+7 (build 21.0.4+7-LTS)'
        + '\nOpenJDK 64-Bit Server VM Temurin-21.0.4+7 (build 21.0.4+7-LTS, mixed mode, sharing)')
      expect(version).to.be.equal(21)
    })

    it('returns 21 for a bare major version "21"', () => {
      const version = JavaLanguageClient.getJavaVersionFromOutput('openjdk version "21" 2023-09-19'
        + '\nOpenJDK Runtime Environment (build 21+35-2513)'
        + '\nOpenJDK 64-Bit Server VM (build 21+35-2513, mixed mode, sharing)')
      expect(version).to.be.equal(21)
    })
  })
})
