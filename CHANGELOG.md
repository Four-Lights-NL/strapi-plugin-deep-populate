# Changelog

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

[1.2.3]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.2.3

[1.2.2]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.2.2

[1.2.1]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.2.1

[1.2.0]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.2.0

[1.1.2]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.1.2

[1.1.1]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.1.1

[1.1.0]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.1.0

[1.0.0]: https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/releases/tag/v1.0.0
