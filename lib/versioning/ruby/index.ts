import {
  eq,
  gt,
  maxSatisfying,
  minSatisfying,
  satisfies,
  valid,
} from '@snyk/ruby-semver';
import { logger } from '../../logger';
import { NewValueConfig, VersioningApi } from '../common';
import { isSingleOperator, isValidOperator } from './operator';
import { ltr, parse as parseRange } from './range';
import { bump, pin, replace } from './strategies';
import { parse as parseVersion } from './version';

export const id = 'ruby';
export const displayName = 'Ruby';
export const urls = [
  'https://guides.rubygems.org/patterns/',
  'https://bundler.io/v1.5/gemfile.html',
  'https://www.devalot.com/articles/2012/04/gem-versions.html',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

function vtrim<T = unknown>(version: T): string | T {
  if (typeof version === 'string') {
    return version.replace(/^v/, '').replace(/('|")/g, '');
  }
  return version;
}

const equals = (left: string, right: string): boolean =>
  eq(vtrim(left), vtrim(right));

const getMajor = (version: string): number =>
  parseVersion(vtrim(version)).major;
const getMinor = (version: string): number =>
  parseVersion(vtrim(version)).minor;
const getPatch = (version: string): number =>
  parseVersion(vtrim(version)).patch;

export const isVersion = (version: string): boolean => !!valid(vtrim(version));
const isGreaterThan = (left: string, right: string): boolean =>
  gt(vtrim(left), vtrim(right));
const isLessThanRange = (version: string, range: string): boolean =>
  ltr(vtrim(version), vtrim(range));

const isSingleVersion = (range: string): boolean => {
  const { version, operator } = parseRange(vtrim(range));

  return operator
    ? isVersion(version) && isSingleOperator(operator)
    : isVersion(version);
};

function isStable(version: string): boolean {
  const v = vtrim(version);
  return parseVersion(v).prerelease ? false : isVersion(v);
}

export const isValid = (input: string): boolean =>
  input
    .split(',')
    .map((piece) => vtrim(piece.trim()))
    .every((range) => {
      const { version, operator } = parseRange(range);

      return operator
        ? isVersion(version) && isValidOperator(operator)
        : isVersion(version);
    });

export const matches = (version: string, range: string): boolean =>
  satisfies(vtrim(version), vtrim(range));
const maxSatisfyingVersion = (versions: string[], range: string): string =>
  maxSatisfying(versions.map(vtrim), vtrim(range));
const minSatisfyingVersion = (versions: string[], range: string): string =>
  minSatisfying(versions.map(vtrim), vtrim(range));

const getNewValue = ({
  currentValue,
  rangeStrategy,
  fromVersion,
  toVersion,
}: NewValueConfig): string => {
  let newValue = null;
  if (isVersion(currentValue)) {
    newValue = currentValue.startsWith('v') ? 'v' + toVersion : toVersion;
  } else if (currentValue.replace(/^=\s*/, '') === fromVersion) {
    newValue = currentValue.replace(fromVersion, toVersion);
  } else {
    switch (rangeStrategy) {
      case 'update-lockfile':
        if (satisfies(toVersion, currentValue)) {
          newValue = currentValue;
        } else {
          newValue = getNewValue({
            currentValue,
            rangeStrategy: 'replace',
            fromVersion,
            toVersion,
          });
        }
        break;
      case 'pin':
        newValue = pin({ to: vtrim(toVersion) });
        break;
      case 'bump':
        newValue = bump({ range: vtrim(currentValue), to: vtrim(toVersion) });
        break;
      case 'replace':
        newValue = replace({
          range: vtrim(currentValue),
          to: vtrim(toVersion),
        });
        break;
      // istanbul ignore next
      default:
        logger.warn(`Unsupported strategy ${rangeStrategy}`);
    }
  }
  if (/^('|")/.exec(currentValue)) {
    const delimiter = currentValue[0];
    return newValue
      .split(',')
      .map((element) => element.replace(/^(\s*)/, `$1${delimiter}`))
      .map((element) => element.replace(/(\s*)$/, `${delimiter}$1`))
      .join(',');
  }
  return newValue;
};

export const sortVersions = (left: string, right: string): number =>
  gt(vtrim(left), vtrim(right)) ? 1 : -1;

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
export default api;
