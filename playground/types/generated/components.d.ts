import type { Schema, Struct } from '@strapi/strapi';

export interface CmsCoolComponent extends Struct.ComponentSchema {
  collectionName: 'components_cms_cool_components';
  info: {
    description: '';
    displayName: 'cool-component';
  };
  attributes: {
    isCool: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    specialRepeatable: Schema.Attribute.Component<'cms.special', true>;
    specialSingle: Schema.Attribute.Component<'cms.special', false>;
    text: Schema.Attribute.RichText;
    title: Schema.Attribute.String;
  };
}

export interface CmsSlider extends Struct.ComponentSchema {
  collectionName: 'components_cms_slider';
  info: {
    description: '';
    displayName: 'Slider';
  };
  attributes: {
    autoplay: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    autoplaySpeed: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 400;
        },
        number
      > &
      Schema.Attribute.DefaultTo<3000>;
    className: Schema.Attribute.String;
    draggable: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    height: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<67>;
    infinite: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    items: Schema.Attribute.Component<'shared.slider-item', true>;
    spacing: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface CmsSpecial extends Struct.ComponentSchema {
  collectionName: 'components_cms_specials';
  info: {
    description: '';
    displayName: 'special';
  };
  attributes: {
    isSpecial: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    name: Schema.Attribute.String;
    users: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface SharedLink extends Struct.ComponentSchema {
  collectionName: 'components_shared_links';
  info: {
    description: '';
    displayName: 'link';
    icon: 'backward';
  };
  attributes: {
    href: Schema.Attribute.String;
    isExternal: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    page: Schema.Attribute.Relation<'oneToOne', 'api::page.page'>;
    target: Schema.Attribute.Enumeration<['_blank']>;
  };
}

export interface SharedSliderItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_slider_item';
  info: {
    description: '';
    displayName: 'Slider Item';
  };
  attributes: {
    enabled: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    image: Schema.Attribute.Media<'images'> & Schema.Attribute.Required;
    link: Schema.Attribute.Component<'shared.link', false>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'cms.cool-component': CmsCoolComponent;
      'cms.slider': CmsSlider;
      'cms.special': CmsSpecial;
      'shared.link': SharedLink;
      'shared.slider-item': SharedSliderItem;
    }
  }
}
