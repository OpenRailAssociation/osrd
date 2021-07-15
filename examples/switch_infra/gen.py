import os, sys, inspect
current_dir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parent_dir = os.path.dirname(current_dir)
grand_parent_dir = os.path.dirname(parent_dir)
sys.path.insert(0, grand_parent_dir)
import examples_generator.libgen as gen

# build the network
infra = gen.Infra([1000] * 3)
infra.add_switch(0, 1, 2)

# build the trains
sim = gen.Simulation(infra)
sim.add_schedule(0, 0, 1)
sim.add_schedule(0, 2, 0) 

# build the successions
succession = gen.Succession()
succession.add_table(0, 1, 2, [0, 1])

gen.write_json("config.json", gen.CONFIG_JSON)
gen.write_json("infra.json", infra.to_json())
gen.write_json("simulation.json", sim.to_json())
gen.write_json("succession.json", succession.to_json())
