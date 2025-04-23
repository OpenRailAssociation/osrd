ALTER TABLE train_schedule
ADD COLUMN category rolling_stock_category;

ALTER TABLE paced_train
ADD COLUMN category rolling_stock_category;
