export type SubscriptionCategory = {
  subscriptionCateId: string;
  subscriptioncatename: string;
  subscriptioncateslug: string;
  desc: string;
  subscriptionplans: SubscriptionPlan[];
  createdAt: Date;
  updatedAt: Date;
};
export type SubscriptionPlan = {
  subscriptionPlanId: string;
  subscriptionplanname: string;
  subscriptionplanslug: string;
  subscriptionplandesc: string;
  subscriptionpackage: SubscriptionPackageOption[];
  createdAt: Date;
  updatedAt: Date;
};
export type SubscriptionPackageOption = {
  SubscriptionPackageId: string;
  subscriptionPackagename: string;
  subscriptionPackagephoto: string;
  subscriptionPackageads: string;
  subscriptionPackagerenews: string;
  subscriptionPackageautorenews: string;
  subscriptionPackagevideos: string;
  subscriptionterm: SubscriptionTermOption[];
  createdAt: Date;
  updatedAt: Date;
};

export type SubscriptionTermDurationUnit = "day" | "month" | "year";

export type SubscriptionTermOption = {
  SubscriptionTermId: string;
  subscriptiontermname: string;
  subscriptiontermdurationvalue: number;
  subscriptiontermdurationunit: SubscriptionTermDurationUnit;
  subscriptiontermprice: number;
  subscriptiontermdiscount: number;
  subscriptiontermdiscounttype: SubscriptionTermDiscountType;
  createdAt: Date;
  updatedAt: Date;
};
export type SubscriptionTermDiscountType = "percent" | "amount";

export type UserSubscription = {
  SubscriptionId: string;
  reportName: string;
  userId: string;
  subscriptionCateId: string;
  reportPostDescription: string;
  reportPostCreatedAt: Date;
};
