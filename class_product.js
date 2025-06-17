// eslint-disable-next-line no-unused-vars
class Product {
    id;
    link;
    description_full;
    description_short;
    data_recommendation_id;
    data_recommendation_type;
    data_img_url;
    data_img_alt;
    data_asin;
    data_asin_is_parent;
    data_is_pre_release;
    data_childs;
    data_estimated_tax;
    data_estimated_tax_prize;
    data_tax_currency;
    data_contributors;
    data_feature_bullets;
    data_limited_quantity;
    data_catalogSize;
    real_prize;
    isFav = 0;
    isNew = 1;
    isNotified = false;
    gotRemoved = false;
    ts_firstSeen = unixTimeStamp();
    ts_lastSeen = unixTimeStamp();
    notSeenCounter = 0;
    order_success = false;
    generated_short = false;
    gotFromDB = undefined;
    constructor(id) {
        this.id = id;
    };
}
