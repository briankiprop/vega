import {isLogarithmic} from './scales';
import {Time, UTC} from './scales/types';
import {
  formatSpan,
  formatVariablePrecision,
  format as numberFormat,
  timeFormat,
  utcFormat
} from 'vega-format';
import {timeInterval, utcInterval} from 'vega-time';
import {error, isArray, isNumber, isObject, isString, peek, span} from 'vega-util';

const defaultFormatter = value => isArray(value)
  ? value.map(v => String(v))
  : String(value);

/**
 * Determine the tick count or interval function.
 * @param {Scale} scale - The scale for which to generate tick values.
 * @param {*} count - The desired tick count or interval specifier.
 * @param {number} minStep - The desired minimum step between tick values.
 * @return {*} - The tick count or interval function.
 */
export function tickCount(scale, count, minStep) {
  var step;

  if (isNumber(count)) {
    if (scale.bins) {
      count = Math.max(count, scale.bins.length);
    }
    if (minStep != null) {
      count = Math.min(
        count,
        Math.floor((span(scale.domain()) / minStep) || 1)
      );
    }
  }

  if (isObject(count)) {
    step = count.step;
    count = count.interval;
  }

  if (isString(count)) {
    count = scale.type === Time ? timeInterval(count)
      : scale.type == UTC ? utcInterval(count)
      : error('Only time and utc scales accept interval strings.');
    if (step) count = count.every(step);
  }

  return count;
}

/**
 * Filter a set of candidate tick values, ensuring that only tick values
 * that lie within the scale range are included.
 * @param {Scale} scale - The scale for which to generate tick values.
 * @param {Array<*>} ticks - The candidate tick values.
 * @param {*} count - The tick count or interval function.
 * @return {Array<*>} - The filtered tick values.
 */
export function validTicks(scale, ticks, count) {
  let range = scale.range(),
      lo = range[0],
      hi = peek(range);

  if (lo > hi) {
    range = hi;
    hi = lo;
    lo = range;
  }

  lo = Math.floor(lo);
  hi = Math.ceil(hi);

  ticks = ticks.filter(v => {
    v = scale(v);
    return lo <= v && v <= hi;
  });

  if (count > 0 && ticks.length > 1) {
    const endpoints = [ticks[0], peek(ticks)];
    while (ticks.length > count && ticks.length >= 3) {
      ticks = ticks.filter((_, i) => !(i % 2));
    }
    if (ticks.length < 3) {
      ticks = endpoints;
    }
  }

  return ticks;
}

/**
 * Generate tick values for the given scale and approximate tick count or
 * interval value. If the scale has a 'ticks' method, it will be used to
 * generate the ticks, with the count argument passed as a parameter. If the
 * scale lacks a 'ticks' method, the full scale domain will be returned.
 * @param {Scale} scale - The scale for which to generate tick values.
 * @param {*} [count] - The approximate number of desired ticks.
 * @return {Array<*>} - The generated tick values.
 */
export function tickValues(scale, count) {
  return scale.bins ? validTicks(scale, scale.bins)
    : scale.ticks ? scale.ticks(count)
    : scale.domain();
}

/**
 * Generate a label format function for a scale. If the scale has a
 * 'tickFormat' method, it will be used to generate the formatter, with the
 * count and specifier arguments passed as parameters. If the scale lacks a
 * 'tickFormat' method, the returned formatter performs simple string coercion.
 * If the input scale is a logarithmic scale and the format specifier does not
 * indicate a desired decimal precision, a special variable precision formatter
 * that automatically trims trailing zeroes will be generated.
 * @param {Scale} scale - The scale for which to generate the label formatter.
 * @param {*} [count] - The approximate number of desired ticks.
 * @param {string} [specifier] - The format specifier. Must be a legal d3
 *   specifier string (see https://github.com/d3/d3-format#formatSpecifier) or
 *   time multi-format specifier object.
 * @return {function(*):string} - The generated label formatter.
 */
export function tickFormat(scale, count, specifier, formatType, noSkip) {
  var type = scale.type;
  let format = defaultFormatter;

  if (type === Time || formatType === Time) {
    format = timeFormat(specifier);
  }
  else if (type === UTC || formatType === UTC) {
    format = utcFormat(specifier);
  }
  else if (isLogarithmic(type)) {
    const logfmt = scale.tickFormat(count, specifier),
          varfmt = formatVariablePrecision(specifier);
    format = noSkip || scale.bins
      ? varfmt
      : _ => logfmt(_) ? varfmt(_) : '';
  }
  else if (scale.tickFormat) {
    // if d3 scale has tickFormat, it must be continuous
    const d = scale.domain();
    format = formatSpan(d[0], d[d.length - 1], count, specifier);
  }
  else if (specifier) {
    format = numberFormat(specifier);
  }

  return format;
}
