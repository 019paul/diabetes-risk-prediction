const POSITIVE_CLASS_LABEL = 'Yes, self-reported previous diabetes diagnosis'
const NEGATIVE_CLASS_LABEL = 'No self-reported previous diabetes diagnosis'

export function getPredictionDisplay(prediction) {
  const isPositive = prediction?.predicted_class === POSITIVE_CLASS_LABEL
  const isNegative = prediction?.predicted_class === NEGATIVE_CLASS_LABEL
  return {
    classification: isPositive
      ? 'Positive classification'
      : isNegative
        ? 'Negative classification'
        : 'Classification label unavailable',
    isNegative,
    isPositive,
  }
}
