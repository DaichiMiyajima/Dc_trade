var tools = function() {

};

/**
 * Rounds a value up to an amount of decimals and returns it.
 * @param value
 * @param decimals
 * @returns {number}
 */
tools.prototype.round = function round(value, decimals) {
  // Shift
  value = value.toString().split('e');
  value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + decimals) : decimals)));
  // Shift back
  value = value.toString().split('e');
  return Number((value[0] + 'e' + (value[1] ? (+value[1] - decimals) : -decimals)));
};

/**
* 小数点n位までを残す関数
* number=対象の数値
* n=残したい小数点以下の桁数
 */
tools.prototype.floor = function floor(number, n) {
  var _pow = Math.pow( 10 , n ) ;
  return Math.floor( number * _pow ) / _pow ;
};


var utiltools = new tools();

module.exports = utiltools;
