import os, sys, inspect
current_dir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parent_dir = os.path.dirname(current_dir)
grand_parent_dir = os.path.dirname(parent_dir)
sys.path.insert(0, grand_parent_dir)
import examples_generator.libgen as gen

# build the network

lengths = [
    1000, # 0
    1000,
    1000,
    1000,
    1000,
    1000, # 5
    1000,
    1000,
    1000,
    1000
]

infra = gen.Infra(lengths)

infra.add_link(0, 1, 1000, 0)
infra.add_link(1, 2, 2000, 0)
infra.add_link(2, 3, 3000, 0)
infra.add_link(3, 4, 4000, 0)
infra.add_link(4, 5, 5000, 0)
infra.add_link(5, 6, 6000, 0)
infra.add_link(6, 7, 7000, 0)
infra.add_link(7, 8, 8000, 0)
infra.add_link(8, 9, 9000, 0)

infra.set_buffer_stop_coordinates(0, 0, 0)
infra.set_buffer_stop_coordinates(9, 10000, 0)

# build the trains
sim = gen.Simulation(infra)

sim.add_schedule(0, 0, 9)

# build the successions
succession = gen.Succession()

gen.write_json("config.json", gen.CONFIG_JSON)
gen.write_json("infra.json", infra.to_json())
gen.write_json("simulation.json", sim.to_json())
gen.write_json("succession.json", succession.to_json())
