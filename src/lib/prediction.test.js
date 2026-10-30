import assert from 'node:assert/strict'
import test from 'node:test'
import { getPredictionDisplay } from './prediction.js'

test('positive Flask response identifies the positive research class', () => {
  const result = getPredictionDisplay({
    predicted_class: 'Yes, self-reported previous diabetes diagnosis',
    positive_class_probability: 0.856,
    negative_class_probability: 0.144,
  })

  assert.equal(result.classification, 'Positive classification')
  assert.equal(result.isPositive, true)
  assert.equal(result.isNegative, false)
})

test('negative Flask response identifies the negative research class', () => {
  const result = getPredictionDisplay({
    predicted_class: 'No self-reported previous diabetes diagnosis',
    positive_class_probability: 0.002,
    negative_class_probability: 0.998,
  })

  assert.equal(result.classification, 'Negative classification')
  assert.equal(result.isPositive, false)
  assert.equal(result.isNegative, true)
})

test('unrecognized research classes are not presented as positive or negative', () => {
  const result = getPredictionDisplay({ predicted_class: 'unknown' })

  assert.equal(result.classification, 'Classification label unavailable')
  assert.equal(result.isPositive, false)
  assert.equal(result.isNegative, false)
})
