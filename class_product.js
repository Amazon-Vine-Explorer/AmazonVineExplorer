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
    data_estimated_tax;
    prize;
    isFav = false;
    isNew = true;
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
