import assert from 'node:assert/strict'
import test from 'node:test'
import { getPredictionDisplay } from './prediction.js'

test('positive Flask response displays class 1 and its actual probabilities', () => {
  const result = getPredictionDisplay({
    predicted_class: 'Yes, self-reported previous diabetes diagnosis',
    positive_class_probability: 0.856,
    negative_class_probability: 0.144,
  })

  assert.equal(result.classification, 'Positive classification')
  assert.equal(result.isPositive, true)
  assert.equal(result.isNegative, false)
  assert.equal(result.classProbabilities.positivePercentage, '85.6%')
  assert.equal(result.classProbabilities.negativePercentage, '14.4%')
})

test('negative Flask response displays class 0 and its actual probabilities', () => {
  const result = getPredictionDisplay({
    predicted_class: 'No self-reported previous diabetes diagnosis',
    positive_class_probability: 0.002,
    negative_class_probability: 0.998,
  })

  assert.equal(result.classification, 'Negative classification')
  assert.equal(result.isPositive, false)
  assert.equal(result.isNegative, true)
  assert.equal(result.classProbabilities.positivePercentage, '0.2%')
  assert.equal(result.classProbabilities.negativePercentage, '99.8%')
})

test('missing or inconsistent probabilities do not produce display values', () => {
  const result = getPredictionDisplay({
    predicted_class: 'No self-reported previous diabetes diagnosis',
    positive_class_probability: 0.75,
    negative_class_probability: 0.75,
  })

  assert.equal(result.classification, 'Negative classification')
  assert.equal(result.classProbabilities, null)
})
