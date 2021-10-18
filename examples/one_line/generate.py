import os, sys, inspect
current_dir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)
import generator.libgen as gen

# build the network
infra = gen.Infra([1000] * 10)
for i in range(9):
    infra.add_link(i, i + 1)

# build the trains
sim = gen.Simulation(infra)
sim.add_schedule(0, 0, 9)
sim.add_schedule(0, 9, 0)

# build the successions
succession = gen.Succession()

gen.write_json("config.json", gen.CONFIG_JSON)
gen.write_json("infra.json", infra.to_json())
gen.write_json("simulation.json", sim.to_json())
gen.write_json("succession.json", succession.to_json())
