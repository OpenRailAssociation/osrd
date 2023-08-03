from railjson_generator import InfraBuilder, get_output_dir

OUTPUT_DIR = get_output_dir()


# GENERATE INFRA
builder = InfraBuilder()

# Create track sections

track_a = builder.add_track_section(length=200, label="track_a")
track_b = builder.add_track_section(length=200, label="track_b")
track_c = builder.add_track_section(length=200, label="track_c")
track_d = builder.add_track_section(length=200, label="track_d")
link = builder.add_link(track_d.end(), track_a.begin())

switch1 = builder.add_point_switch(track_a.end(), track_b.begin(), track_c.begin(), label="switch1")

switch2 = builder.add_point_switch(track_d.begin(), track_b.end(), track_c.end(), label="switch2")

# Build infra
infra = builder.build()

# Save railjson
infra.save(OUTPUT_DIR / "infra.json")
