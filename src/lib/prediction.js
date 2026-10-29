const POSITIVE_CLASS_LABEL = 'Yes, self-reported previous diabetes diagnosis'
const NEGATIVE_CLASS_LABEL = 'No self-reported previous diabetes diagnosis'

function getClassProbabilities(prediction) {
  const positive = prediction?.positive_class_probability
  const negative = prediction?.negative_class_probability
  if (
    !Number.isFinite(positive)
    || !Number.isFinite(negative)
    || positive < 0
    || positive > 1
    || negative < 0
    || negative > 1
    || Math.abs(positive + negative - 1) > 0.001
  ) {
    return null
  }
  return {
    negative,
    negativePercentage: `${(negative * 100).toFixed(1)}%`,
    positive,
    positivePercentage: `${(positive * 100).toFixed(1)}%`,
  }
}

export function getPredictionDisplay(prediction) {
  const isPositive = prediction?.predicted_class === POSITIVE_CLASS_LABEL
  const isNegative = prediction?.predicted_class === NEGATIVE_CLASS_LABEL
  return {
    classification: isPositive
      ? 'Positive classification'
      : isNegative
        ? 'Negative classification'
        : 'Classification label unavailable',
    classProbabilities: getClassProbabilities(prediction),
    isNegative,
    isPositive,
  }
}
