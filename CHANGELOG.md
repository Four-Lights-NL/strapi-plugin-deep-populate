# Changelog

## [1.7.0] - 2025-10-08

### Breaking Changes

- Populate now stops revisiting the content type where the relation originated that content type is self-referencing, so projects that depended on the wider traversal should add allow-list overrides ([#83](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/83)) (Thomas Rijpstra)

### Improvements

- Reduced array lookup overhead inside populate logic to keep deep queries responsive ([#79](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/79)) (Thomas Rijpstra)
- Expanded memory-stress coverage and overall test reliance ([#79](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/79)) (Thomas Rijpstra)
- Add flag to control if localizations should be populated ([#85](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/85)) (Thomas Rijpstra)

### Security Updates

- Updated dependencies across the plugin, playground, and test harness to pull in upstream security patches ([#74](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/74), [#75](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/75), [#76](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/76), [#77](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/77)) (Thomas Rijpstra)

### Bug Fixes

- Eliminated the runaway recursion that previously re-entered the starting content type, preventing out of memory and unresponsive requests ([#81](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/83)) (Thomas Rijpstra)

## [1.6.2] - 2025-06-25

### Changed

- Use biome v2 ([`a8c759e`](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/commit/a8c759e) [`7eec941`](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/commit/7eec941)) (Thomas Rijpstra)
- Improve test stability and reliability ([#64](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/64)) (Thomas Rijpstra)
- Mitigate security vulnerabilities by updating dependencies to latest versions ([`096db68`](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/commit/096db68) [`e313ed6`](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/commit/e313ed6) [#72](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/72) [#71](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/71) [#70](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/70) [#69](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/69) [#67](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/67) [#64](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/64) [#63](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/63)) (Thomas Rijpstra)

## [1.6.1] - 2025-04-07

### Fixed

- Fix deeply nested components not always resolving correctly due to incorrect value determination ([#61](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/61)) (Thomas Rijpstra)
- Fix media attribute resolving throwing vague exceptions ([#61](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/61)) (Thomas Rijpstra)

## [1.6.0] - 2025-04-03

### Fixed

- Fix plugin hanging due to internalization quirks ([#59](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/59)) (Thomas Rijpstra)
- Fix status field not being forwarded properly during resolving ([#59](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/59)) (Thomas Rijpstra)
- Fix localizations always included regardless of model options ([#59](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/59)) (Thomas Rijpstra)

## [1.5.1] - 2025-03-25

### Fixed

- Fix plugin hanging on simple content-types when caching is enabled ([#53](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/53)) (Thomas Rijpstra)

## [1.5.0] - 2025-02-13

### Changed

- Update `README` with `wildcard` allow/deny lists example ([#49](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/49)) (Thomas Rijpstra)

### Fixed

- Fix inconsistent return type of populate `get` ([#49](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/49)) (Thomas Rijpstra)

## [1.4.1] - 2025-02-12

### Changed

- Allow & Deny lists can now also be set with a `*` (wildcard) ([#46](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/46)) (Thomas Rijpstra)

- Localizations will not be populated unless specifically asked to ([#47](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/47)) (Thomas Rijpstra)

## [1.4.0] - 2025-02-12

### Added

- You can now configure the plugin using optional `deny` and `allow` lists to control where it should not go ([#43](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/43), [#43](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/43)) (Thomas Rijpstra)

## [1.3.1] - 2025-02-12

### Changed

- Use `lodash/get` instead of `dlv` for path lookups ([#40](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/40)) (Thomas Rijpstra)
- Use lodash equivalent utilities for `dset` and `klona` ([#40](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/40)) (Thomas Rijpstra)

### Fixed

- Fix incorrect merging of nested populate relations ([#40](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/40)) (Thomas Rijpstra)
- Fix middleware error when object was not found ([#39](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/39)) (Thomas Rijpstra)

## [1.3.0] - 2025-02-10

### Changed

- **BREAKING CHANGE** Changed configuration properties to better reflect what each option does ([#37](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/37)) (Thomas Rijpstra)
- Renamed cache database table to `populate_cache` so that it's clear what it holds ([#37](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/37)) (Thomas Rijpstra)

### Fixed

- Fix replacement of populate wildcard when using strapi's core factories ([#37](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/37)) (Thomas Rijpstra)

## [1.2.4] - 2025-02-10

### Fixed

- Caching will now graciously handle simultaneous cache writes ([#35](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/35)) (Thomas Rijpstra)

## [1.2.3] - 2025-02-10

### Changed

- Improve creation and cleanup of full-text cache index ([#33](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/33)) (Thomas Rijpstra)

### Fixed

- Allow specifying unlimited dependencies for a cache entry ([#33](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/33)) (Thomas Rijpstra)

## [1.2.2] - 2025-02-10

### Changed

- Cache lookups will now be quicker on sqlite, mysql/mariadb or postgresql due to full-text index on cache dependencies ([#31](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/31)) (Thomas Rijpstra)

## [1.2.1] - 2025-02-10

### Fixed

- **HOTFIX**: remove incorrect experimental index ([`3a31985`](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/commit/3a31985)) (Thomas Rijpstra)

## [1.2.0] - 2025-02-09

### Added

- Out-of-the-box support for `populate: *` ([#21](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/21)) (Thomas Rijpstra)
- Full support for `DocumentService`'s `locale` and `status` fields ([#26](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/26)) (Thomas Rijpstra)
- Intelligent caching mechanism for deep populate ([#22](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/22), [#25](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/25)) (Thomas Rijpstra)

### Removed

- Wrapped document service methods

## [1.1.2] - 2025-02-04

### Fixed

- Fix deep populate choking on circular references through components ([#17](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/17)) (Thomas Rijpstra)

## [1.1.1] - 2025-01-31

### Fixed

- Fix resolving of deeply nested components and relations ([#12](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/12)) (Thomas Rijpstra)

## [1.1.0] - 2025-01-29

### Fixed

- `media` attributes will now be populated as well ([#10](https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/10)) (Thomas Rijpstra)

## [1.0.0] - 2025-01-27

_:seedling: Initial release._

[1.7.0]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.7.0

[1.6.2]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.6.2

[1.6.1]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.6.1

[1.6.0]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.6.0

[1.5.1]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.5.1

[1.5.0]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.5.0

[1.4.1]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.4.1

[1.4.0]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.4.0

[1.3.1]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.3.1

[1.3.0]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.3.0

[1.2.5]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.2.5

[1.2.4]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.2.4

[1.2.3]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.2.3

[1.2.2]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.2.2

[1.2.1]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.2.1

[1.2.0]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.2.0

[1.1.2]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.1.2

[1.1.1]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.1.1

[1.1.0]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.1.0

[1.0.0]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.0.0
