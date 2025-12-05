'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Avatar,
  Alert,
  Tooltip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
  Grid,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Group as GroupIcon,
  PersonAdd as PersonAddIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  PersonRemove as PersonRemoveIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { groupsAPI, usersAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Group {
  group_id: string;
  name: string;
  description: string;
  group_type: string;
  member_count: number;
  created_at: string;
}

interface GroupDetails extends Group {
  members: Member[];
}

interface Member {
  user_id: string;
  username: string;
  display_name: string;
  email: string;
  role: string;
  membership_role: string;
  joined_at: string;
}

interface User {
  user_id: string;
  username: string;
  display_name: string;
  email: string;
  role: string;
}

const GROUP_TYPES = ['Team', 'Department', 'Project', 'External'];
const MEMBERSHIP_ROLES = ['Member', 'Lead', 'Owner'];

export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);

  // Selected group
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    group_type: 'Team',
  });

  // Add member form
  const [memberForm, setMemberForm] = useState({
    user_id: '',
    membership_role: 'Member',
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const canEdit = user?.role === 'Admin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [groupsRes, usersRes] = await Promise.all([
        groupsAPI.getAll(),
        usersAPI.getAll(),
      ]);
      setGroups(groupsRes.data.groups || []);
      const userData = usersRes.data;
      setUsers(Array.isArray(userData) ? userData : userData.users || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupDetails = async (groupId: string) => {
    try {
      const response = await groupsAPI.getById(groupId);
      setGroupDetails(response.data);
    } catch (err: any) {
      console.error('Failed to fetch group details:', err);
    }
  };

  const handleCreateGroup = async () => {
    try {
      await groupsAPI.create(formData);
      setSuccess('Group created successfully');
      setCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create group');
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup) return;
    try {
      await groupsAPI.update(selectedGroup.group_id, formData);
      setSuccess('Group updated successfully');
      setEditDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update group');
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    try {
      await groupsAPI.delete(selectedGroup.group_id);
      setSuccess('Group deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedGroup(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete group');
    }
  };

  const handleAddMember = async () => {
    if (!selectedGroup || !selectedUser) return;
    try {
      await groupsAPI.addMember(selectedGroup.group_id, {
        user_id: selectedUser.user_id,
        membership_role: memberForm.membership_role,
      });
      setSuccess(`${selectedUser.display_name} added to group`);
      setAddMemberDialogOpen(false);
      setSelectedUser(null);
      setMemberForm({ user_id: '', membership_role: 'Member' });
      fetchGroupDetails(selectedGroup.group_id);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!selectedGroup) return;
    try {
      await groupsAPI.removeMember(selectedGroup.group_id, userId);
      setSuccess(`${userName} removed from group`);
      fetchGroupDetails(selectedGroup.group_id);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to remove member');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      group_type: 'Team',
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const openEditDialog = (group: Group) => {
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      group_type: group.group_type || 'Team',
    });
    setEditDialogOpen(true);
  };

  const openViewDialog = async (group: Group) => {
    setSelectedGroup(group);
    await fetchGroupDetails(group.group_id);
    setViewDialogOpen(true);
  };

  const openDeleteDialog = (group: Group) => {
    setSelectedGroup(group);
    setDeleteDialogOpen(true);
  };

  const openAddMemberDialog = (group: Group) => {
    setSelectedGroup(group);
    setSelectedUser(null);
    setMemberForm({ user_id: '', membership_role: 'Member' });
    setAddMemberDialogOpen(true);
  };

  const getTypeColor = (type: string): 'primary' | 'secondary' | 'success' | 'warning' | 'info' => {
    const colors: { [key: string]: 'primary' | 'secondary' | 'success' | 'warning' | 'info' } = {
      Team: 'primary',
      Department: 'secondary',
      Project: 'success',
      External: 'warning',
    };
    return colors[type] || 'info';
  };

  const getRoleColor = (role: string): 'default' | 'primary' | 'secondary' => {
    const colors: { [key: string]: 'default' | 'primary' | 'secondary' } = {
      Owner: 'primary',
      Lead: 'secondary',
      Member: 'default',
    };
    return colors[role] || 'default';
  };

  const filteredGroups = groups.filter((group) => {
    if (!searchText) return true;
    return (
      group.name.toLowerCase().includes(searchText.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  // Get available users (not already in group)
  const availableUsers = groupDetails
    ? users.filter((u) => !groupDetails.members.some((m) => m.user_id === u.user_id))
    : users;

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Groups
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchData} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canEdit && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
              New Group
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Search */}
      <Card sx={{ mb: 2, p: 2 }}>
        <TextField
          fullWidth
          placeholder="Search groups by name or description..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          size="small"
        />
      </Card>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Group</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="center">Members</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No groups found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group) => (
                  <TableRow key={group.group_id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <GroupIcon />
                        </Avatar>
                        <Typography fontWeight={500}>{group.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{group.description || '-'}</TableCell>
                    <TableCell>
                      <Chip label={group.group_type} size="small" color={getTypeColor(group.group_type)} />
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={`${group.member_count || 0} members`} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => openViewDialog(group)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      {canEdit && (
                        <>
                          <Tooltip title="Add Member">
                            <IconButton size="small" color="primary" onClick={() => openAddMemberDialog(group)}>
                              <PersonAddIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEditDialog(group)}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => openDeleteDialog(group)}>
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Create Group Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Group</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            margin="normal"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Group Type</InputLabel>
            <Select
              value={formData.group_type}
              label="Group Type"
              onChange={(e) => setFormData({ ...formData, group_type: e.target.value })}
            >
              {GROUP_TYPES.map((type) => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateGroup} disabled={!formData.name}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Group</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            margin="normal"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Group Type</InputLabel>
            <Select
              value={formData.group_type}
              label="Group Type"
              onChange={(e) => setFormData({ ...formData, group_type: e.target.value })}
            >
              {GROUP_TYPES.map((type) => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateGroup} disabled={!formData.name}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Group Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                <GroupIcon />
              </Avatar>
              <Typography variant="h6">{selectedGroup?.name}</Typography>
            </Box>
            <Chip label={selectedGroup?.group_type} color={getTypeColor(selectedGroup?.group_type || '')} />
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">Description</Typography>
              <Typography>{selectedGroup?.description || 'No description'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Created</Typography>
              <Typography>
                {selectedGroup?.created_at ? new Date(selectedGroup.created_at).toLocaleDateString() : '-'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Members</Typography>
              <Typography>{groupDetails?.members?.length || 0}</Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1">Members ({groupDetails?.members?.length || 0})</Typography>
            {canEdit && (
              <Button
                size="small"
                startIcon={<PersonAddIcon />}
                onClick={() => {
                  setViewDialogOpen(false);
                  if (selectedGroup) openAddMemberDialog(selectedGroup);
                }}
              >
                Add Member
              </Button>
            )}
          </Box>

          {groupDetails?.members && groupDetails.members.length > 0 ? (
            <List>
              {groupDetails.members.map((member) => (
                <ListItem key={member.user_id}>
                  <ListItemAvatar>
                    <Avatar>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={member.display_name}
                    secondary={`${member.email} • ${member.role}`}
                  />
                  <Chip
                    label={member.membership_role || 'Member'}
                    size="small"
                    color={getRoleColor(member.membership_role)}
                    sx={{ mr: 1 }}
                  />
                  {canEdit && (
                    <ListItemSecondaryAction>
                      <Tooltip title="Remove from group">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveMember(member.user_id, member.display_name)}
                        >
                          <PersonRemoveIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No members in this group.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Group</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the group &quot;{selectedGroup?.name}&quot;?
            This will remove all member associations.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteGroup}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onClose={() => setAddMemberDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Member to {selectedGroup?.name}</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={availableUsers}
            getOptionLabel={(option) => `${option.display_name} (${option.email})`}
            value={selectedUser}
            onChange={(_, newValue) => setSelectedUser(newValue)}
            renderInput={(params) => (
              <TextField {...params} label="Select User" margin="normal" fullWidth />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                <Box>
                  <Typography>{option.display_name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.email} • {option.role}
                  </Typography>
                </Box>
              </li>
            )}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Membership Role</InputLabel>
            <Select
              value={memberForm.membership_role}
              label="Membership Role"
              onChange={(e) => setMemberForm({ ...memberForm, membership_role: e.target.value })}
            >
              {MEMBERSHIP_ROLES.map((role) => (
                <MenuItem key={role} value={role}>{role}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddMember} disabled={!selectedUser}>
            Add Member
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
