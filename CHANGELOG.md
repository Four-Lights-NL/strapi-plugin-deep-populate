# Changelog

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
