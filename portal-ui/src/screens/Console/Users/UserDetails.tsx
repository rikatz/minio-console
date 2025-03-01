// This file is part of MinIO Console Server
// Copyright (c) 2021 MinIO, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import React, { Fragment, useCallback, useEffect, useState } from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";

import { createStyles, Theme, withStyles } from "@material-ui/core/styles";
import { Button, Grid, IconButton, Tooltip } from "@material-ui/core";
import {
  AddIcon,
  DeleteIcon,
  IAMPoliciesIcon,
  UsersIcon,
} from "../../../icons";
import {
  setErrorSnackMessage,
  setModalErrorSnackMessage,
} from "../../../actions";
import {
  actionsTray,
  containerForHeader,
  searchField,
} from "../Common/FormComponents/common/styleLibrary";
import { IPolicyItem } from "./types";
import { ErrorResponseHandler } from "../../../common/types";
import { TabPanel } from "../../shared/tabs";
import PageHeader from "../Common/PageHeader/PageHeader";
import api from "../../../common/api";
import TableWrapper from "../Common/TableWrapper/TableWrapper";
import ChangeUserGroups from "./ChangeUserGroups";
import SetUserPolicies from "./SetUserPolicies";
import history from "../../../history";
import UserServiceAccountsPanel from "./UserServiceAccountsPanel";
import ChangeUserPasswordModal from "../Account/ChangeUserPasswordModal";
import DeleteUserString from "./DeleteUserString";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import List from "@material-ui/core/List";
import LockIcon from "@material-ui/icons/Lock";
import ScreenTitle from "../Common/ScreenTitle/ScreenTitle";

const styles = (theme: Theme) =>
  createStyles({
    seeMore: {
      marginTop: theme.spacing(3),
    },
    paper: {
      // padding: theme.spacing(2),
      display: "flex",
      overflow: "auto",
      flexDirection: "column",
    },
    addSideBar: {
      width: "320px",
      padding: "20px",
    },
    tableToolbar: {
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(0),
    },
    wrapCell: {
      maxWidth: "200px",
      whiteSpace: "normal",
      wordWrap: "break-word",
    },
    minTableHeader: {
      color: "#393939",
      "& tr": {
        "& th": {
          fontWeight: "bold",
        },
      },
    },
    fixedHeight: {
      height: 165,
      minWidth: 247,
      padding: "25px 28px",
      "& svg": {
        maxHeight: 18,
      },
    },
    paperContainer: {
      padding: 15,
      paddingLeft: 50,
      display: "flex",
    },
    gridContainer: {
      display: "grid",
      gridTemplateColumns: "auto auto",
      gridGap: 8,
      justifyContent: "flex-start",
      alignItems: "center",
      "& div:not(.MuiCircularProgress-root)": {
        display: "flex",
        alignItems: "center",
      },
      "& div:nth-child(odd)": {
        justifyContent: "flex-end",
        fontWeight: 700,
      },
      "& div:nth-child(2n)": {
        minWidth: 150,
      },
    },
    breadcrumLink: {
      textDecoration: "none",
      color: "black",
    },
    ...actionsTray,
    ...searchField,
    actionsTray: { ...actionsTray.actionsTray },
    ...containerForHeader(theme.spacing(4)),
  });

interface IUserDetailsProps {
  classes: any;
  match: any;
  setErrorSnackMessage: typeof setErrorSnackMessage;
}

interface IGroupItem {
  group: string;
}

const UserDetails = ({ classes, match }: IUserDetailsProps) => {
  const [curTab, setCurTab] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [addGroupOpen, setAddGroupOpen] = useState<boolean>(false);
  const [policyOpen, setPolicyOpen] = useState<boolean>(false);
  const [addLoading, setAddLoading] = useState<boolean>(false);

  const [enabled, setEnabled] = useState<boolean>(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [currentGroups, setCurrentGroups] = useState<IGroupItem[]>([]);
  const [currentPolicies, setCurrentPolicies] = useState<IPolicyItem[]>([]);
  const [changeUserPasswordModalOpen, setChangeUserPasswordModalOpen] =
    useState<boolean>(false);
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [hasPolicy, setHasPolicy] = useState<boolean>(false);

  const userName = match.params["userName"];

  const changeUserPassword = () => {
    setChangeUserPasswordModalOpen(true);
  };

  const deleteUser = () => {
    setDeleteOpen(true);
  };

  const getUserInformation = useCallback(() => {
    if (userName === "") {
      return null;
    }
    setLoading(true);
    api
      .invoke("GET", `/api/v1/user?name=${encodeURIComponent(userName)}`)
      .then((res) => {
        setAddLoading(false);
        const memberOf = res.memberOf || [];
        setSelectedGroups(memberOf);
        let currentGroups: IGroupItem[] = [];
        for (let group of memberOf) {
          currentGroups.push({
            group: group,
          });
        }
        setCurrentGroups(currentGroups);
        let currentPolicies: IPolicyItem[] = [];
        for (let policy of res.policy) {
          currentPolicies.push({
            policy: policy,
          });
        }
        setCurrentPolicies(currentPolicies);
        setEnabled(res.status === "enabled");
        setHasPolicy(res.hasPolicy);
        setLoading(false);
      })
      .catch((err: ErrorResponseHandler) => {
        setAddLoading(false);
        setLoading(false);
        setModalErrorSnackMessage(err);
      });
  }, [userName]);

  const saveRecord = (isEnabled: boolean) => {
    if (addLoading) {
      return;
    }
    setAddLoading(true);
    api
      .invoke("PUT", `/api/v1/user?name=${encodeURIComponent(userName)}`, {
        status: isEnabled ? "enabled" : "disabled",
        groups: selectedGroups,
      })
      .then((_) => {
        setAddLoading(false);
      })
      .catch((err: ErrorResponseHandler) => {
        setAddLoading(false);
        setModalErrorSnackMessage(err);
      });
  };

  useEffect(() => {
    getUserInformation();
  }, [getUserInformation]);

  const closeDeleteModalAndRefresh = (refresh: boolean) => {
    setDeleteOpen(false);
    if (refresh) {
      getUserInformation();
    }
  };

  return (
    <React.Fragment>
      <PageHeader
        label={
          <Fragment>
            <Link to={"/users"} className={classes.breadcrumLink}>
              Users
            </Link>
          </Fragment>
        }
        actions={<React.Fragment></React.Fragment>}
      />
      {addGroupOpen && (
        <ChangeUserGroups
          open={addGroupOpen}
          selectedUser={userName}
          closeModalAndRefresh={() => {
            setAddGroupOpen(false);
            getUserInformation();
          }}
        />
      )}
      {policyOpen && (
        <SetUserPolicies
          open={policyOpen}
          selectedUser={userName}
          currentPolicies={currentPolicies}
          closeModalAndRefresh={() => {
            setPolicyOpen(false);
            getUserInformation();
          }}
        />
      )}
      {deleteOpen && (
        <DeleteUserString
          deleteOpen={deleteOpen}
          userName={userName}
          closeDeleteModalAndRefresh={(refresh: boolean) => {
            closeDeleteModalAndRefresh(refresh);
          }}
        />
      )}
      {changeUserPasswordModalOpen && (
        <ChangeUserPasswordModal
          open={changeUserPasswordModalOpen}
          userName={userName}
          closeModal={() => setChangeUserPasswordModalOpen(false)}
        />
      )}
      <Grid container className={classes.container}>
        <Grid item xs={12}>
          <ScreenTitle
            icon={
              <Fragment>
                <UsersIcon width={40} />
              </Fragment>
            }
            title={userName}
            subTitle={
              <Fragment>Status: {enabled ? "Enabled" : "Disabled"}</Fragment>
            }
            actions={
              <Fragment>
                <Button
                  onClick={() => {
                    setEnabled(!enabled);
                    saveRecord(!enabled);
                  }}
                  color={"primary"}
                >
                  {enabled ? "Disable" : "Enable"}
                </Button>
                <Tooltip title="Delete User">
                  <IconButton
                    color="primary"
                    aria-label="Delete User"
                    component="span"
                    onClick={deleteUser}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Change Password">
                  <IconButton
                    color="primary"
                    aria-label="Change Password"
                    component="span"
                    onClick={changeUserPassword}
                  >
                    <LockIcon />
                  </IconButton>
                </Tooltip>
              </Fragment>
            }
          />
        </Grid>
        <Grid item xs={2}>
          <List component="nav" dense={true}>
            <ListItem
              button
              selected={curTab === 0}
              onClick={() => {
                setCurTab(0);
              }}
            >
              <ListItemText primary="Groups" />
            </ListItem>
            <ListItem
              button
              selected={curTab === 1}
              onClick={() => {
                setCurTab(1);
              }}
            >
              <ListItemText primary="Service Accounts" />
            </ListItem>
            <ListItem
              button
              selected={curTab === 2}
              onClick={() => {
                setCurTab(2);
              }}
            >
              <ListItemText primary="Policies" />
            </ListItem>
          </List>
        </Grid>
        <Grid item xs={10}>
          <Grid item xs={12}>
            <TabPanel index={0} value={curTab}>
              <div className={classes.actionsTray}>
                <h1 className={classes.sectionTitle}>Groups</h1>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  size="medium"
                  onClick={() => {
                    setAddGroupOpen(true);
                  }}
                >
                  Add to Groups
                </Button>
              </div>
              <br />
              <TableWrapper
                // itemActions={userTableActions}
                columns={[{ label: "Name", elementKey: "group" }]}
                isLoading={loading}
                records={currentGroups}
                entityName="Groups"
                idField="group"
              />
            </TabPanel>
            <TabPanel index={1} value={curTab}>
              <UserServiceAccountsPanel
                user={userName}
                classes={classes}
                hasPolicy={hasPolicy}
              />
            </TabPanel>
            <TabPanel index={2} value={curTab}>
              <div className={classes.actionsTray}>
                <h1 className={classes.sectionTitle}>Policies</h1>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<IAMPoliciesIcon />}
                  size="medium"
                  onClick={() => {
                    setPolicyOpen(true);
                  }}
                >
                  Assign Policies
                </Button>
              </div>
              <br />
              <TableWrapper
                itemActions={[
                  {
                    type: "view",
                    onClick: (policy: IPolicyItem) => {
                      history.push(`/policies/${policy.policy}`);
                    },
                  },
                ]}
                columns={[{ label: "Name", elementKey: "policy" }]}
                isLoading={loading}
                records={currentPolicies}
                entityName="Policies"
                idField="policy"
              />
            </TabPanel>
          </Grid>
        </Grid>
      </Grid>
    </React.Fragment>
  );
};

const mapDispatchToProps = {
  setErrorSnackMessage,
};

const connector = connect(null, mapDispatchToProps);

export default withStyles(styles)(connector(UserDetails));
