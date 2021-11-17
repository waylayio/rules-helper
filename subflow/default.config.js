module.exports = [{
  name: 'AND',
  description: 'gate to combine inputs, will continue if all inputs are truthy',
  plugins: [{
    name: 'AND',
    type: 'gate',
    triggers: [
      'TRUE'
    ]
  }]
},
{
  name: 'OR',
  description: 'gate to combine inputs, will continue if one of the inputs is truthy',
  plugins: [{
    name: 'OR',
    type: 'gate',
    triggers: [
      'TRUE'
    ]
  }]
}]
