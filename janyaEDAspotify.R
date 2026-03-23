library(jsonlite)
library(tidyverse)
library(lubridate)
df1 <- jsonlite::read_json("StreamingHistory_music_0.json", simplifyVector = TRUE)
df2 <- jsonlite::read_json("StreamingHistory_music_1.json", simplifyVector = TRUE)
spotify <- dplyr::bind_rows(df1, df2)
spotify_clean <- spotify %>%
  mutate(
    endTime = ymd_hm(endTime),
    date = as.Date(endTime),
    year = year(endTime),
    month = month(endTime, label = TRUE, abbr = FALSE),
    day_of_week = wday(endTime, label = TRUE, abbr = FALSE),
    hour = hour(endTime),
    minutesPlayed = msPlayed / 60000
  )
# summary stats 
spotify_clean <- spotify_clean %>%
  filter(minutesPlayed > 0.1)
summary_stats <- spotify_clean %>%
  summarise(
    total_minutes = sum(minutesPlayed),
    total_hours = total_minutes / 60,
    total_streams = n(),
    unique_artists = n_distinct(artistName),
    unique_tracks = n_distinct(trackName),
    avg_daily_minutes = mean(tapply(minutesPlayed, date, sum)),
    median_daily_minutes = median(tapply(minutesPlayed, date, sum)),
    sd_daily_minutes = sd(tapply(minutesPlayed, date, sum)),
    max_daily_minutes = max(tapply(minutesPlayed, date, sum)),
    min_daily_minutes = min(tapply(minutesPlayed, date, sum))
  )

# listening time by hour
hourly_listening <- spotify_clean %>%
  group_by(hour) %>%
  summarise(total_minutes = sum(minutesPlayed))

ggplot(hourly_listening, aes(x = hour, y = total_minutes)) +
  geom_line() +
  geom_point() +
  labs(
    title = "Listening Time by Hour",
    x = "Hour of Day",
    y = "Minutes Listened"
  ) +
  theme_minimal()

#. monthly listening 
monthly_listening <- spotify_clean %>%
  group_by(year, month) %>%
  summarise(total_minutes = sum(minutesPlayed)) %>%
  arrange(year, month)

ggplot(monthly_listening, aes(x = interaction(month, year), y = total_minutes, group = 1)) +
  geom_line() +
  geom_point() +
  labs(
    title = "Monthly Listening Activity",
    x = "Month",
    y = "Total Minutes Listened"
  ) +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

# daily listening 
daily_listening <- spotify_clean %>%
  group_by(date, year, month) %>%
  summarise(daily_minutes = sum(minutesPlayed))

ggplot(daily_listening, aes(x = interaction(month, year), y = daily_minutes)) +
  geom_boxplot() +
  labs(
    title = "Distribution of Daily Listening per Month",
    x = "Month",
    y = "Minutes Listened per Day"
  ) +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

# listening session lengths 
# listening session lengths

spotify_sessions <- spotify_clean %>%
  arrange(endTime) %>%
  mutate(
    gap_minutes = as.numeric(difftime(endTime, lag(endTime), units = "mins")),
    new_session = if_else(is.na(gap_minutes) | gap_minutes > 30, 1, 0),
    session_id = cumsum(new_session)
  )

session_lengths <- spotify_sessions %>%
  group_by(session_id) %>%
  summarise(session_minutes = sum(minutesPlayed))

ggplot(session_lengths, aes(x = session_minutes)) +
  geom_histogram(
    binwidth = 50,
    fill = "#2C7FB8",
    color = "black"
  ) +
  labs(
    title = "Listening Session Lengths (minutes)",
    x = "Minutes",
    y = "Number of Sessions"
  ) +
  theme_minimal()

# heatmap
heatmap_data <- spotify_clean %>%
  group_by(day_of_week, hour) %>%
  summarise(total_minutes = sum(minutesPlayed))

ggplot(heatmap_data, aes(x = hour, y = day_of_week, fill = total_minutes)) +
  geom_tile() +
  labs(
    title = "Listening Heatmap (Day vs Hour)",
    x = "Hour of Day",
    y = "Day of Week"
  ) +
  scale_fill_gradient(low = "lightyellow", high = "darkblue") +
  theme_minimal()

top_artists <- spotify_clean %>%
  group_by(artistName) %>%
  summarise(total_minutes = sum(minutesPlayed)) %>%
  arrange(desc(total_minutes)) %>%
  slice_head(n = 5)

ggplot(top_artists, aes(x = reorder(artistName, total_minutes), y = total_minutes)) +
  geom_col() +
  coord_flip() +
  labs(
    title = "Top 5 Artists by Listening Time",
    x = "Artist",
    y = "Total Minutes Listened"
  ) +
  theme_minimal()


artist_totals <- spotify_clean %>%
  group_by(artistName) %>%
  summarise(total_minutes = sum(minutesPlayed))

artist_segments <- artist_totals %>%
  mutate(
    segment = case_when(
      total_minutes <= quantile(total_minutes, 0.5) ~ "Light listeners",
      total_minutes <= quantile(total_minutes, 0.9) ~ "Moderate listeners",
      TRUE ~ "Super listeners"
    )
  )

segment_counts <- artist_segments %>%
  group_by(segment) %>%
  summarise(count = n())
segment_minutes <- artist_segments %>%
  group_by(segment) %>%
  summarise(total_minutes = sum(total_minutes))

ggplot(segment_counts, aes(x = "", y = count, fill = segment)) +
  geom_col() +
  coord_polar(theta = "y") +
  labs(
    title = "Artist Relationship Breakdown",
    fill = "Segment"
  ) +
  theme_void()

ggplot(segment_minutes, aes(x = segment, y = total_minutes)) +
  geom_col() +
  labs(
    title = "Listening Time by Artist Segment",
    x = "Segment",
    y = "Total Minutes"
  ) +
  theme_minimal()




artist_summary <- spotify_clean %>%
  group_by(artistName) %>%
  summarise(
    total_minutes = sum(minutesPlayed),
    total_streams = n(),
    last_played = max(date)
  )



ggplot(segment_counts, aes(x = "", y = count, fill = segment)) +
  geom_col() +
  coord_polar(theta = "y") +
  geom_text(aes(label = paste0(percentage, "%")),
            position = position_stack(vjust = 0.5)) +
  labs(
    title = "Artist Relationship Breakdown",
    fill = "Segment"
  ) +
  theme_void()




ggplot(
  segment_minutes_new,
  aes(
    x = factor(segment, levels = c("Light listeners", "Moderate listeners", "Previously Active", "Super listeners")),
    y = total_minutes
  )
) +
  geom_col() +
  labs(
    title = "Listening Time by Artist Segment",
    x = "Segment",
    y = "Total Minutes"
  ) +
  theme_minimal()